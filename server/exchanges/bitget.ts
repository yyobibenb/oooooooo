import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "bitget",
  name: "Bitget",
  wsUrl: "wss://ws.bitget.com/v2/ws/public",
  makerFee: 0.001,
  takerFee: 0.001
};

export class BitgetExchange extends BaseExchange {
  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    return pair.replace("/", "");
  }

  parseSymbol(symbol: string): string {
    if (symbol.endsWith("USDT")) return `${symbol.replace("USDT", "")}/USDT`;
    if (symbol.endsWith("USDC")) return `${symbol.replace("USDC", "")}/USDC`;
    return symbol;
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
        { instType: "SPOT", channel: "ticker", instId },
        { instType: "SPOT", channel: "books5", instId }
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
        { instType: "SPOT", channel: "ticker", instId },
        { instType: "SPOT", channel: "books5", instId }
      ];
    });

    this.send({
      op: "unsubscribe",
      args
    });
  }

  protected sendPing(): void {
    this.send({ op: "ping" });
  }

  protected handleMessage(message: unknown): void {
    const msg = message as { 
      action?: string;
      arg?: { channel: string; instId: string };
      data?: unknown[];
    };
    
    if (!msg.arg || !msg.data || msg.data.length === 0) return;

    if (msg.arg.channel === "ticker") {
      this.handleTicker(msg.arg.instId, msg.data[0]);
    } else if (msg.arg.channel === "books5") {
      this.handleOrderBook(msg.arg.instId, msg.data[0]);
    }
  }

  private handleTicker(instId: string, data: unknown): void {
    const d = data as {
      bidPr: string;
      askPr: string;
      lastPr: string;
      baseVolume: string;
      change24h: string;
    };

    const ticker: Ticker = {
      exchange: "bitget",
      pair: this.parseSymbol(instId),
      bid: parseFloat(d.bidPr) || 0,
      ask: parseFloat(d.askPr) || 0,
      last: parseFloat(d.lastPr) || 0,
      volume24h: parseFloat(d.baseVolume) || 0,
      change24h: parseFloat(d.change24h) * 100 || 0,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }

  private handleOrderBook(instId: string, data: unknown): void {
    const d = data as { bids: [string, string][]; asks: [string, string][] };
    
    const orderBook: OrderBook = {
      exchange: "bitget",
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
