import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "gateio",
  name: "Gate.io",
  wsUrl: "wss://api.gateio.ws/ws/v4/",
  makerFee: 0.002,
  takerFee: 0.002
};

export class GateioExchange extends BaseExchange {
  private symbolMapping: Record<string, string> = {};
  
  private reverseMapping: Record<string, string> = {};

  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    let formatted = pair.replace("/", "_");
    for (const [from, to] of Object.entries(this.symbolMapping)) {
      formatted = formatted.replace(from, to);
    }
    return formatted;
  }

  parseSymbol(symbol: string): string {
    let parsed = symbol.replace("_", "/");
    for (const [from, to] of Object.entries(this.reverseMapping)) {
      parsed = parsed.replace(from, to);
    }
    return parsed;
  }

  protected onConnected(): void {
    if (this.subscribedPairs.size > 0) {
      this.sendSubscribe([...this.subscribedPairs]);
    }
  }

  protected sendSubscribe(pairs: string[]): void {
    const symbols = pairs.map(pair => this.formatSymbol(pair));

    this.send({
      time: Math.floor(Date.now() / 1000),
      channel: "spot.tickers",
      event: "subscribe",
      payload: symbols
    });

    symbols.forEach(symbol => {
      this.send({
        time: Math.floor(Date.now() / 1000),
        channel: "spot.book_ticker",
        event: "subscribe",
        payload: [symbol]
      });
    });
  }

  protected sendUnsubscribe(pairs: string[]): void {
    const symbols = pairs.map(pair => this.formatSymbol(pair));

    this.send({
      time: Math.floor(Date.now() / 1000),
      channel: "spot.tickers",
      event: "unsubscribe",
      payload: symbols
    });

    symbols.forEach(symbol => {
      this.send({
        time: Math.floor(Date.now() / 1000),
        channel: "spot.book_ticker",
        event: "unsubscribe",
        payload: [symbol]
      });
    });
  }

  protected sendPing(): void {
    this.send({
      time: Math.floor(Date.now() / 1000),
      channel: "spot.ping"
    });
  }

  private debugCount = 0;
  
  protected handleMessage(message: unknown): void {
    const msg = message as { 
      channel?: string;
      event?: string;
      result?: unknown;
      error?: unknown;
    };
    
    if (this.debugCount < 20) {
      this.debugCount++;
      console.log(`[Gate.io] Message #${this.debugCount}:`, JSON.stringify(message).slice(0, 600));
    }
    
    if (msg.error) {
      console.log(`[Gate.io] Error:`, JSON.stringify(msg.error));
      return;
    }
    
    if (msg.event === "subscribe" || msg.event === "unsubscribe") {
      return;
    }
    
    if (!msg.channel || !msg.result) return;

    if (msg.channel === "spot.tickers" && msg.event === "update") {
      this.handleTicker(msg.result);
    } else if (msg.channel === "spot.book_ticker" && msg.event === "update") {
      this.handleBookTicker(msg.result);
    }
  }

  private handleTicker(data: unknown): void {
    const d = data as {
      currency_pair: string;
      highest_bid: string;
      lowest_ask: string;
      last: string;
      base_volume: string;
      change_percentage: string;
    };

    if (!d.currency_pair) return;

    const ticker: Ticker = {
      exchange: "gateio",
      pair: this.parseSymbol(d.currency_pair),
      bid: parseFloat(d.highest_bid) || 0,
      ask: parseFloat(d.lowest_ask) || 0,
      last: parseFloat(d.last) || 0,
      volume24h: parseFloat(d.base_volume) || 0,
      change24h: parseFloat(d.change_percentage) || 0,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }

  private handleBookTicker(data: unknown): void {
    const d = data as { 
      s: string;
      b: string;
      B: string;
      a: string;
      A: string;
      t: number;
    };
    
    if (!d.s) return;

    const bidPrice = parseFloat(d.b) || 0;
    const askPrice = parseFloat(d.a) || 0;
    const bidAmount = parseFloat(d.B) || 0;
    const askAmount = parseFloat(d.A) || 0;

    if (bidPrice > 0 || askPrice > 0) {
      const ticker: Ticker = {
        exchange: "gateio",
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
      exchange: "gateio",
      pair: this.parseSymbol(d.s),
      bids: bidPrice > 0 ? [{ price: bidPrice, amount: bidAmount }] : [],
      asks: askPrice > 0 ? [{ price: askPrice, amount: askAmount }] : [],
      timestamp: Date.now()
    };

    this.emitOrderBook(orderBook);
  }
}
