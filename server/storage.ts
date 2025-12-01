import { randomUUID } from "crypto";
import type { 
  Settings, 
  ArbitrageOpportunity, 
  Signal,
  Ticker,
  ConnectionStatus,
  ExchangeId
} from "@shared/schema";
import { EXCHANGES, TRADING_PAIRS } from "@shared/schema";

export interface IStorage {
  getSettings(): Settings;
  updateSettings(settings: Partial<Settings>): Settings;
  
  addOpportunity(opportunity: ArbitrageOpportunity): void;
  getOpportunities(limit?: number): ArbitrageOpportunity[];
  
  addSignal(signal: Signal): void;
  getSignals(limit?: number): Signal[];
  
  updateTicker(ticker: Ticker): void;
  getTickers(): Map<string, Ticker>;
  
  updateConnectionStatus(status: ConnectionStatus): void;
  getConnectionStatuses(): Map<ExchangeId, ConnectionStatus>;
}

export class MemStorage implements IStorage {
  private settings: Settings;
  private opportunities: ArbitrageOpportunity[];
  private signals: Signal[];
  private tickers: Map<string, Ticker>;
  private connectionStatuses: Map<ExchangeId, ConnectionStatus>;

  constructor() {
    this.settings = {
      minProfitPercent: 1,
      enabledExchanges: [...EXCHANGES],
      enabledPairs: [...TRADING_PAIRS],
      telegramEnabled: true,
      soundEnabled: true,
      tradeAmount: 1000
    };
    this.opportunities = [];
    this.signals = [];
    this.tickers = new Map();
    this.connectionStatuses = new Map();
  }

  getSettings(): Settings {
    return { ...this.settings };
  }

  updateSettings(newSettings: Partial<Settings>): Settings {
    this.settings = { ...this.settings, ...newSettings };
    return this.settings;
  }

  addOpportunity(opportunity: ArbitrageOpportunity): void {
    this.opportunities.unshift(opportunity);
    if (this.opportunities.length > 100) {
      this.opportunities.pop();
    }
  }

  getOpportunities(limit: number = 100): ArbitrageOpportunity[] {
    return this.opportunities.slice(0, limit);
  }

  addSignal(signal: Signal): void {
    this.signals.unshift(signal);
    if (this.signals.length > 50) {
      this.signals.pop();
    }
  }

  getSignals(limit: number = 50): Signal[] {
    return this.signals.slice(0, limit);
  }

  updateTicker(ticker: Ticker): void {
    const key = `${ticker.exchange}-${ticker.pair}`;
    this.tickers.set(key, ticker);
  }

  getTickers(): Map<string, Ticker> {
    return new Map(this.tickers);
  }

  updateConnectionStatus(status: ConnectionStatus): void {
    this.connectionStatuses.set(status.exchange, status);
  }

  getConnectionStatuses(): Map<ExchangeId, ConnectionStatus> {
    return new Map(this.connectionStatuses);
  }
}

export const storage = new MemStorage();
