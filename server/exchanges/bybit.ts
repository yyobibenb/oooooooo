import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker, OrderBook } from "@shared/schema";

const config: ExchangeConfig = {
  id: "bybit",
  name: "Bybit",
  wsUrl: "wss://stream.bybit.com/v5/public/spot",
  makerFee: 0.001,
  takerFee: 0.001
};

export class BybitExchange extends BaseExchange {
  constructor() {
    super(config);
  }

  formatSymbol(pair: string): string {
    return pair.replace("/", "");
  }

  parseSymbol(symbol: string): string {
    // BTCUSDT -> BTC/USDT
    const base = symbol.replace("USDT", "").replace("USDC", "").replace("BTC", "");
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
    // Subscribe in smaller batches to avoid issues
    const symbols = pairs.map(pair => this.formatSymbol(pair));
    
    // Subscribe to tickers
    symbols.forEach(symbol => {
      this.send({
        op: "subscribe",
        args: [`tickers.${symbol}`]
      });
    });
    
    // Subscribe to orderbooks
    symbols.forEach(symbol => {
      this.send({
        op: "subscribe", 
        args: [`orderbook.50.${symbol}`]
      });
    });
  }

  protected sendUnsubscribe(pairs: string[]): void {
    const args = pairs.flatMap(pair => {
      const symbol = this.formatSymbol(pair);
      return [
        `tickers.${symbol}`,
        `orderbook.25.${symbol}`
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
    const msg = message as { topic?: string; data?: unknown; type?: string; op?: string; success?: boolean };
    
    if (msg.op === "subscribe") return;
    if (!msg.topic || !msg.data) return;

    if (msg.topic.startsWith("tickers.")) {
      this.handleTicker(msg.data);
    } else if (msg.topic.startsWith("orderbook.")) {
      this.handleOrderBook(msg.topic, msg.data);
    }
  }

  private handleTicker(data: unknown): void {
    const d = data as {
      symbol: string;
      bid1Price?: string;
      ask1Price?: string;
      lastPrice: string;
      volume24h: string;
      price24hPcnt: string;
    };

    const lastPrice = parseFloat(d.lastPrice) || 0;
    
    // Use bid1Price/ask1Price if available, otherwise estimate from lastPrice
    const bid = d.bid1Price ? parseFloat(d.bid1Price) : lastPrice * 0.9999;
    const ask = d.ask1Price ? parseFloat(d.ask1Price) : lastPrice * 1.0001;

    const ticker: Ticker = {
      exchange: "bybit",
      pair: this.parseSymbol(d.symbol),
      bid: bid,
      ask: ask,
      last: lastPrice,
      volume24h: parseFloat(d.volume24h) || 0,
      change24h: parseFloat(d.price24hPcnt) * 100 || 0,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }

  private handleOrderBook(topic: string, data: unknown): void {
    const d = data as { s: string; b: [string, string][]; a: [string, string][] };
    
    const orderBook: OrderBook = {
      exchange: "bybit",
      pair: this.parseSymbol(d.s),
      bids: (d.b || []).map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount)
      })),
      asks: (d.a || []).map(([price, amount]) => ({
        price: parseFloat(price),
        amount: parseFloat(amount)
      })),
      timestamp: Date.now()
    };

    this.emitOrderBook(orderBook);
  }
}
