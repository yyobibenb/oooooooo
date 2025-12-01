import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker } from "@shared/schema";

const config: ExchangeConfig = {
  id: "bingx",
  name: "BingX",
  wsUrl: "wss://open-api-ws.bingx.com/market",
  makerFee: 0.001,
  takerFee: 0.001
};

export class BingXExchange extends BaseExchange {
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
    for (const pair of pairs) {
      const symbol = this.formatSymbol(pair);
      this.send({
        id: Date.now().toString(),
        reqType: "sub",
        dataType: `${symbol}@ticker`
      });
    }
  }

  protected sendUnsubscribe(pairs: string[]): void {
    for (const pair of pairs) {
      const symbol = this.formatSymbol(pair);
      this.send({
        id: Date.now().toString(),
        reqType: "unsub",
        dataType: `${symbol}@ticker`
      });
    }
  }

  protected sendPing(): void {
    this.send({ ping: Date.now() });
  }

  protected handleMessage(message: unknown): void {
    const msg = message as { 
      dataType?: string;
      data?: {
        s?: string;
        c?: string;
        o?: string;
        h?: string;
        l?: string;
        v?: string;
      };
      pong?: number;
      code?: number;
      msg?: string;
    };

    if (msg.pong) return;
    if (msg.code) return;
    
    if (msg.dataType?.includes("@ticker") && msg.data) {
      this.handleTicker(msg.data);
    }
  }

  private handleTicker(data: {
    s?: string;
    c?: string;
    o?: string;
    h?: string;
    l?: string;
    v?: string;
  }): void {
    if (!data.s || !data.c) return;
    
    const lastPrice = parseFloat(data.c) || 0;
    if (lastPrice <= 0) return;

    const openPrice = parseFloat(data.o || "0") || lastPrice;
    const change24h = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;

    const ticker: Ticker = {
      exchange: "bingx",
      pair: this.parseSymbol(data.s),
      bid: lastPrice * 0.9999,
      ask: lastPrice * 1.0001,
      last: lastPrice,
      volume24h: parseFloat(data.v || "0") || 0,
      change24h,
      timestamp: Date.now()
    };

    this.emitTicker(ticker);
  }
}
