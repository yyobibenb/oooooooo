import { EventEmitter } from "events";
import { randomUUID } from "crypto";
import type { 
  Ticker, 
  ArbitrageOpportunity, 
  Settings, 
  ExchangeId
} from "@shared/schema";
import { EXCHANGE_INFO, EXCHANGES, TRADING_PAIRS } from "@shared/schema";

interface AnalysisResult {
  pair: string;
  prices: { exchange: ExchangeId; price: number }[];
  bestBuy: { exchange: ExchangeId; price: number };
  bestSell: { exchange: ExchangeId; price: number };
  spread: number;
  timestamp: number;
}

export class ArbitrageEngine extends EventEmitter {
  private tickers: Map<string, Ticker> = new Map();
  private settings: Settings = {
    minProfitPercent: 1,
    enabledExchanges: [...EXCHANGES],
    enabledPairs: [...TRADING_PAIRS],
    telegramEnabled: true,
    soundEnabled: true,
    tradeAmount: 1000
  };
  private lastOpportunities: Map<string, number> = new Map();
  private analysisCount: number = 0;
  private readonly COOLDOWN_MS = 30000;

  constructor() {
    super();
    
    // Start continuous analysis
    this.startContinuousAnalysis();
  }

  private startContinuousAnalysis(): void {
    // Analyze all pairs continuously
    setInterval(() => {
      this.analyzeAllPairs();
    }, 1000);
  }

  private analyzeAllPairs(): void {
    for (const pair of this.settings.enabledPairs) {
      this.analyzePair(pair);
    }
  }

  private analyzePair(pair: string): void {
    const prices: { exchange: ExchangeId; price: number }[] = [];
    
    for (const exchange of this.settings.enabledExchanges) {
      const key = `${exchange}-${pair}`;
      const ticker = this.tickers.get(key);
      if (ticker && ticker.ask > 0 && ticker.bid > 0) {
        prices.push({ 
          exchange, 
          price: ticker.ask 
        });
      }
    }

    if (prices.length < 2) return;

    // Sort by price
    prices.sort((a, b) => a.price - b.price);
    
    const bestBuy = prices[0];
    const bestSell = prices[prices.length - 1];
    
    // Get actual bid for sell exchange (high precision)
    const sellTicker = this.tickers.get(`${bestSell.exchange}-${pair}`);
    const sellPrice = sellTicker?.bid || bestSell.price;
    
    // High precision spread calculation (avoid floating point errors)
    const priceDiff = sellPrice - bestBuy.price;
    const spread = (priceDiff / bestBuy.price) * 100;
    
    this.analysisCount++;
    
    // Emit analysis result for logging
    const analysisResult: AnalysisResult = {
      pair,
      prices,
      bestBuy,
      bestSell: { exchange: bestSell.exchange, price: sellPrice },
      spread,
      timestamp: Date.now()
    };
    
    // Only emit if spread is notable
    if (spread >= 0.3) {
      this.emit("analysis", analysisResult);
    }

    // Check if profitable after fees (high precision calculations)
    const buyFee = EXCHANGE_INFO[bestBuy.exchange].takerFee;
    const sellFee = EXCHANGE_INFO[bestSell.exchange].takerFee;
    const totalFees = (buyFee + sellFee) * 100;
    const profitPercent = spread - totalFees;

    if (profitPercent >= this.settings.minProfitPercent) {
      const opportunityKey = `${pair}-${bestBuy.exchange}-${bestSell.exchange}`;
      const lastTime = this.lastOpportunities.get(opportunityKey) || 0;
      
      if (Date.now() - lastTime < this.COOLDOWN_MS) return;
      
      this.lastOpportunities.set(opportunityKey, Date.now());

      // Ultra high precision: 12 decimals for prices, 10 for percentages
      const buyPriceHP = parseFloat(bestBuy.price.toFixed(12));
      const sellPriceHP = parseFloat(sellPrice.toFixed(12));
      const spreadHP = parseFloat(spread.toFixed(10));
      const profitHP = parseFloat(profitPercent.toFixed(10));
      const tradeAmount = this.settings.tradeAmount;
      
      // Calculate fees in dollars with ultra high precision
      const buyFeeUSD = parseFloat((buyFee * tradeAmount).toFixed(10));
      const sellFeeUSD = parseFloat((sellFee * tradeAmount).toFixed(10));
      const estimatedProfitUSD = parseFloat(((profitHP / 100) * tradeAmount).toFixed(10));

      const opportunity: ArbitrageOpportunity = {
        id: randomUUID(),
        pair,
        buyExchange: bestBuy.exchange,
        sellExchange: bestSell.exchange,
        buyPrice: buyPriceHP,
        sellPrice: sellPriceHP,
        spreadPercent: spreadHP,
        profitPercent: profitHP,
        estimatedProfit: estimatedProfitUSD,
        volume: 0,
        buyFee: buyFeeUSD,
        sellFee: sellFeeUSD,
        timestamp: Date.now()
      };

      console.log(`[Arbitrage] 🔥 FOUND: ${pair} | ${bestBuy.exchange} -> ${bestSell.exchange} | Spread: ${spreadHP.toFixed(10)}% | Net: +${profitHP.toFixed(10)}% | ~$${estimatedProfitUSD.toFixed(8)}`);
      this.emit("opportunity", opportunity);
    }
  }

  updateSettings(newSettings: Partial<Settings>): void {
    this.settings = { ...this.settings, ...newSettings };
  }

  getSettings(): Settings {
    return this.settings;
  }

  updateTicker(ticker: Ticker): void {
    const key = `${ticker.exchange}-${ticker.pair}`;
    this.tickers.set(key, ticker);
  }

  getPricesForPair(pair: string): { exchange: ExchangeId; ticker: Ticker }[] {
    const prices: { exchange: ExchangeId; ticker: Ticker }[] = [];
    
    for (const exchange of EXCHANGES) {
      const key = `${exchange}-${pair}`;
      const ticker = this.tickers.get(key);
      if (ticker) {
        prices.push({ exchange, ticker });
      }
    }
    
    return prices.sort((a, b) => a.ticker.ask - b.ticker.ask);
  }

  getAllTickers(): Ticker[] {
    return Array.from(this.tickers.values());
  }

  getAnalysisCount(): number {
    return this.analysisCount;
  }
}
