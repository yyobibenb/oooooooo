import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "okx",
  name: "OKX",
  wsUrl: "wss://ws.okx.com:8443/ws/v5/public",
  makerFee: 0.0008,
  takerFee: 0.001
};

export class OKXExchange extends BaseExchange {
  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    return pair.replace("/", "-");
  }

  parseSymbol(symbol: string): string {
    return symbol.replace("-", "/");
  }

  protected onConnected(): void {
    if (this.subscribedPairs.size > 0) {
      this.sendSubscribe([...this.subscribedPairs]);
    }
  }

  protected sendSubscribe(pairs: string[]): void {
    const args = pairs.flatMap(pair => {
      const instId = this.formatSymbol(pair);
      return [
        { channel: "tickers", instId },
        { channel: "books5", instId }
      ];
    });

    this.send({
      op: "subscribe",
      args
    });
  }

  protected sendUnsubscribe(pairs: string[]): void {
    const args = pairs.flatMap(pair => {
      const instId = this.formatSymbol(pair);
      return [
        { channel: "tickers", instId },
        { channel: "books5", instId }
      ];
    });

    this.send({
      op: "unsubscribe",
      args
    });
  }

  protected sendPing(): void {
    if (this.ws?.readyState === 1) {
      this.ws.ping();
    }
  }

  protected handleMessage(message: unknown): void {
    const msg = message as { 
      arg?: { channel: string; instId: string }; 
      data?: unknown[];
      event?: string;
    };
    
    if (msg.event === "subscribe" || msg.event === "error") return;
    if (!msg.arg || !msg.data || msg.data.length === 0) return;

    if (msg.arg.channel === "tickers") {
      this.handleTicker(msg.arg.instId, msg.data[0]);
    } else if (msg.arg.channel === "books5") {
      this.handleOrderBook(msg.arg.instId, msg.data[0]);
    }
  }

  private handleTicker(instId: string, data: unknown): void {
    const d = data as {
      bidPx: string;
      askPx: string;
      last: string;
      vol24h: string;
      sodUtc0: string;
    };

    const lastPrice = parseFloat(d.last) || 0;
    const openPrice = parseFloat(d.sodUtc0) || lastPrice;
    const change24h = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;

    const ticker: Ticker = {
      exchange: "okx",
      pair: this.parseSymbol(instId),
      bid: parseFloat(d.bidPx) || 0,
      ask: parseFloat(d.askPx) || 0,
      last: lastPrice,
      volume24h: parseFloat(d.vol24h) || 0,
      change24h,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }

  private handleOrderBook(instId: string, data: unknown): void {
    const d = data as { bids: [string, string, string, string][]; asks: [string, string, string, string][] };
    
    const orderBook: OrderBook = {
      exchange: "okx",
      pair: this.parseSymbol(instId),
      bids: (d.bids || []).map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount)
      })),
      asks: (d.asks || []).map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount)
      })),
      timestamp: Date.now()
    };

    this.emitOrderBook(orderBook);
  }
}
