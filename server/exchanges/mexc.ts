import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "mexc",
  name: "MEXC",
  wsUrl: "wss://wbs.mexc.com/ws",
  makerFee: 0.0,
  takerFee: 0.001,
  proxyUrl: process.env.MEXC_PROXY_URL
};

interface MexcTickerResponse {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  bidPrice: string;
  askPrice: string;
  volume: string;
  quoteVolume: string;
}

export class MEXCExchange extends BaseExchange {
  private pollingInterval: NodeJS.Timeout | null = null;
  private isPolling = false;
  private useRestApi = true;
  
  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    return pair.replace("/", "").toUpperCase();
  }

  parseSymbol(symbol: string): string {
    if (symbol.endsWith("USDT")) return `${symbol.replace("USDT", "")}/USDT`;
    if (symbol.endsWith("USDC")) return `${symbol.replace("USDC", "")}/USDC`;
    return symbol;
  }

  connect(): void {
    if (this.useRestApi) {
      this.emit("status", { 
        exchange: this.config.id, 
        status: "connecting", 
        lastUpdate: Date.now() 
      });
      console.log("[MEXC] Using REST API polling mode");
      this.startPolling();
      return;
    }
    super.connect();
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
    console.log("[MEXC] REST API polling started");
    
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
      const response = await fetch("https://api.mexc.com/api/v3/ticker/24hr");
      
      if (!response.ok) {
        console.error("[MEXC] REST API error:", response.status);
        return;
      }
      
      const data = await response.json() as MexcTickerResponse[];
      
      const subscribedSymbols = new Set(
        [...this.subscribedPairs].map(pair => this.formatSymbol(pair))
      );
      
      for (const item of data) {
        if (!subscribedSymbols.has(item.symbol)) continue;
        
        const bidPrice = parseFloat(item.bidPrice) || 0;
        const askPrice = parseFloat(item.askPrice) || 0;
        const lastPrice = parseFloat(item.lastPrice) || 0;
        const volume = parseFloat(item.volume) || 0;
        const changePercent = parseFloat(item.priceChangePercent) || 0;
        
        if (bidPrice > 0 && askPrice > 0) {
          const ticker: Ticker = {
            exchange: "mexc",
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
            exchange: "mexc",
            pair: this.parseSymbol(item.symbol),
            bids: [{ price: bidPrice, amount: 0 }],
            asks: [{ price: askPrice, amount: 0 }],
            timestamp: Date.now()
          };
          
          this.emitOrderBook(orderBook);
        }
      }
    } catch (error) {
      console.error("[MEXC] REST API fetch error:", error);
    }
  }

  protected onConnected(): void {
    if (this.subscribedPairs.size > 0 && !this.useRestApi) {
      this.sendSubscribe([...this.subscribedPairs]);
    }
  }

  protected sendSubscribe(pairs: string[]): void {
    if (this.useRestApi) {
      return;
    }
    
    pairs.forEach(pair => {
      const symbol = this.formatSymbol(pair);
      
      this.send({
        method: "SUBSCRIPTION",
        params: [`spot@public.deals.v3.api@${symbol}`]
      });

      this.send({
        method: "SUBSCRIPTION",
        params: [`spot@public.bookTicker.v3.api@${symbol}`]
      });
    });
  }

  protected sendUnsubscribe(pairs: string[]): void {
    if (this.useRestApi) {
      return;
    }
    
    pairs.forEach(pair => {
      const symbol = this.formatSymbol(pair);
      
      this.send({
        method: "UNSUBSCRIPTION",
        params: [`spot@public.deals.v3.api@${symbol}`]
      });

      this.send({
        method: "UNSUBSCRIPTION",
        params: [`spot@public.bookTicker.v3.api@${symbol}`]
      });
    });
  }

  protected sendPing(): void {
    if (!this.useRestApi) {
      this.send({ method: "PING" });
    }
  }

  protected handleMessage(message: unknown): void {
    if (this.useRestApi) return;
    
    const msg = message as { 
      c?: string;
      d?: unknown;
      s?: string;
      msg?: string;
      code?: number;
      id?: number;
    };
    
    if (msg.code !== undefined && msg.code !== 0) {
      return;
    }
    
    if (!msg.c || !msg.d) return;

    if (msg.c.includes("deals")) {
      this.handleDeals(msg.d);
    } else if (msg.c.includes("bookTicker")) {
      this.handleBookTicker(msg.d);
    }
  }

  private handleDeals(data: unknown): void {
    const d = data as {
      deals?: Array<{
        S: number;
        p: string;
        v: string;
        t: number;
      }>;
      s?: string;
    };

    if (!d.deals || !d.s) return;
    
    const latestDeal = d.deals[0];
    if (!latestDeal) return;

    const symbol = d.s;
    const price = parseFloat(latestDeal.p) || 0;

    const ticker: Ticker = {
      exchange: "mexc",
      pair: this.parseSymbol(symbol),
      bid: price * 0.9999,
      ask: price * 1.0001,
      last: price,
      volume24h: 0,
      change24h: 0,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }

  private handleBookTicker(data: unknown): void {
    const d = data as {
      s: string;
      b?: string;
      B?: string;
      a?: string;
      A?: string;
    };

    if (!d.s) return;

    const bidPrice = parseFloat(d.b || "0");
    const askPrice = parseFloat(d.a || "0");
    
    if (bidPrice > 0 && askPrice > 0) {
      const ticker: Ticker = {
        exchange: "mexc",
        pair: this.parseSymbol(d.s),
        bid: bidPrice,
        ask: askPrice,
        last: (bidPrice + askPrice) / 2,
        volume24h: 0,
        change24h: 0,
        timestamp: Date.now()
      };

      this.emitTicker(ticker);
    }

    const orderBook: OrderBook = {
      exchange: "mexc",
      pair: this.parseSymbol(d.s),
      bids: bidPrice > 0 ? [{ price: bidPrice, amount: parseFloat(d.B || "0") }] : [],
      asks: askPrice > 0 ? [{ price: askPrice, amount: parseFloat(d.A || "0") }] : [],
      timestamp: Date.now()
    };

    this.emitOrderBook(orderBook);
  }
}
