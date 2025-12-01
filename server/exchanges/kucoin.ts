import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "kucoin",
  name: "KuCoin",
  wsUrl: "",
  makerFee: 0.001,
  takerFee: 0.001
};

interface KuCoinTickerResponse {
  symbol: string;
  buy: string;
  sell: string;
  last: string;
  vol: string;
  volValue: string;
  changeRate: string;
  changePrice: string;
  high: string;
  low: string;
}

interface KuCoinAllTickersResponse {
  code: string;
  data: {
    time: number;
    ticker: KuCoinTickerResponse[];
  };
}

export class KuCoinExchange extends BaseExchange {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;

  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    return pair.replace("/", "-");
  }

  parseSymbol(symbol: string): string {
    return symbol.replace("-", "/");
  }

  connect(): void {
    this.emit("status", { 
      exchange: this.config.id, 
      status: "connecting", 
      lastUpdate: Date.now() 
    });
    console.log("[KuCoin] Using REST API polling mode");
    this.startPolling();
  }

  disconnect(): void {
    this.stopPolling();
    super.disconnect();
  }

  private startPolling(): void {
    if (this.isPolling) return;
    
    this.isPolling = true;
    this.isConnected = true;
    this.emit("status", { 
      exchange: this.config.id, 
      status: "connected", 
      lastUpdate: Date.now() 
    });
    console.log("[KuCoin] REST API polling started");
    
    this.fetchAllTickers();
    
    this.pollingInterval = setInterval(() => {
      this.fetchAllTickers();
    }, 2000);
  }

  private stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
    this.isPolling = false;
  }

  private async fetchAllTickers(): Promise<void> {
    try {
      const response = await fetch("https://api.kucoin.com/api/v1/market/allTickers");
      
      if (!response.ok) {
        console.error("[KuCoin] REST API error:", response.status);
        return;
      }
      
      const data = await response.json() as KuCoinAllTickersResponse;
      
      if (data.code !== "200000" || !data.data?.ticker) {
        return;
      }
      
      const subscribedSymbols = new Set(
        [...this.subscribedPairs].map(pair => this.formatSymbol(pair))
      );
      
      for (const item of data.data.ticker) {
        if (!subscribedSymbols.has(item.symbol)) continue;
        
        const bidPrice = parseFloat(item.buy) || 0;
        const askPrice = parseFloat(item.sell) || 0;
        const lastPrice = parseFloat(item.last) || 0;
        const volume = parseFloat(item.vol) || 0;
        const changePercent = parseFloat(item.changeRate) * 100 || 0;
        
        if (bidPrice > 0 && askPrice > 0) {
          const ticker: Ticker = {
            exchange: "kucoin",
            pair: this.parseSymbol(item.symbol),
            bid: bidPrice,
            ask: askPrice,
            last: lastPrice,
            volume24h: volume,
            change24h: changePercent,
            timestamp: Date.now()
          };
          
          this.emitTicker(ticker);
          
          const orderBook: OrderBook = {
            exchange: "kucoin",
            pair: this.parseSymbol(item.symbol),
            bids: [{ price: bidPrice, amount: 0 }],
            asks: [{ price: askPrice, amount: 0 }],
            timestamp: Date.now()
          };
          
          this.emitOrderBook(orderBook);
        }
      }
    } catch (error) {
      console.error("[KuCoin] REST API fetch error:", error);
    }
  }

  protected onConnected(): void {
    // Not used in REST API mode
  }

  protected sendSubscribe(pairs: string[]): void {
    // Not used in REST API mode
  }

  protected sendUnsubscribe(pairs: string[]): void {
    // Not used in REST API mode
  }

  protected sendPing(): void {
    // Not used in REST API mode
  }

  protected handleMessage(message: unknown): void {
    // Not used in REST API mode
  }
}
