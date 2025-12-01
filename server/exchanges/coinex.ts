import { BaseExchange, ExchangeConfig } from "./base";
import type { Ticker } from "@shared/schema";

const config: ExchangeConfig = {
  id: "coinex",
  name: "CoinEx",
  wsUrl: "wss://socket.coinex.com/v2/spot",
  makerFee: 0.002,
  takerFee: 0.002
};

export class CoinExExchange extends BaseExchange {
  private messageId: number = 1;

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
    const markets = pairs.map(pair => this.formatSymbol(pair));

    this.send({
      method: "state.subscribe",
      params: { market_list: markets },
      id: this.messageId++
    });
  }

  protected sendUnsubscribe(pairs: string[]): void {
    const markets = pairs.map(pair => this.formatSymbol(pair));

    this.send({
      method: "state.unsubscribe",
      params: { market_list: markets },
      id: this.messageId++
    });
  }

  protected sendPing(): void {
    this.send({
      method: "server.ping",
      params: {},
      id: this.messageId++
    });
  }

  protected handleMessage(message: unknown): void {
    const msg = message as { 
      method?: string;
      data?: {
        state_list?: Array<{
          market: string;
          last: string;
          open: string;
          high: string;
          low: string;
          volume: string;
        }>;
      };
    };
    
    if (msg.method === "state.update" && msg.data?.state_list) {
      this.handleTickers(msg.data.state_list);
    }
  }

  private handleTickers(stateList: Array<{
    market: string;
    last: string;
    open: string;
    high: string;
    low: string;
    volume: string;
  }>): void {
    for (const state of stateList) {
      const lastPrice = parseFloat(state.last) || 0;
      if (lastPrice <= 0) continue;
      
      const openPrice = parseFloat(state.open) || lastPrice;
      const change24h = openPrice > 0 ? ((lastPrice - openPrice) / openPrice) * 100 : 0;

      const ticker: Ticker = {
        exchange: "coinex",
        pair: this.parseSymbol(state.market),
        bid: lastPrice * 0.9999,
        ask: lastPrice * 1.0001,
        last: lastPrice,
        volume24h: parseFloat(state.volume) || 0,
        change24h,
        timestamp: Date.now()
      };

      this.emitTicker(ticker);
    }
  }
}
