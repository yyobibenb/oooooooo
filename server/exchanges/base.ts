import WebSocket from "ws";
import { EventEmitter } from "events";
import * as zlib from "zlib";
import type { Ticker, OrderBook, ExchangeId } from "@shared/schema";
import { HttpsProxyAgent } from "https-proxy-agent";
import { SocksProxyAgent } from "socks-proxy-agent";

export interface ExchangeConfig {
  id: ExchangeId;
  name: string;
  wsUrl: string;
  makerFee: number;
  takerFee: number;
  proxyUrl?: string;
}

export abstract class BaseExchange extends EventEmitter {
  protected ws: WebSocket | null = null;
  protected config: ExchangeConfig;
  protected isConnected: boolean = false;
  protected reconnectTimeout: NodeJS.Timeout | null = null;
  protected pingInterval: NodeJS.Timeout | null = null;
  protected subscribedPairs: Set<string> = new Set();

  constructor(config: ExchangeConfig) {
    super();
    this.config = config;
  }

  get id(): ExchangeId {
    return this.config.id;
  }

  get name(): string {
    return this.config.name;
  }

  get fees(): { maker: number; taker: number } {
    return { maker: this.config.makerFee, taker: this.config.takerFee };
  }

  get connected(): boolean {
    return this.isConnected;
  }

  getStatus(): { exchange: ExchangeId; status: string; lastUpdate: number } {
    return {
      exchange: this.config.id,
      status: this.isConnected ? "connected" : "disconnected",
      lastUpdate: Date.now()
    };
  }

  protected getProxyAgent(): HttpsProxyAgent<string> | SocksProxyAgent | undefined {
    const proxyUrl = this.config.proxyUrl;
    if (!proxyUrl) return undefined;
    
    if (proxyUrl.startsWith("socks")) {
      return new SocksProxyAgent(proxyUrl);
    }
    return new HttpsProxyAgent(proxyUrl);
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.emit("status", { 
      exchange: this.config.id, 
      status: "connecting", 
      lastUpdate: Date.now() 
    });

    try {
      const agent = this.getProxyAgent();
      const wsOptions = agent ? { agent } : undefined;
      this.ws = new WebSocket(this.config.wsUrl, wsOptions);

      this.ws.on("open", () => {
        this.isConnected = true;
        console.log(`[${this.config.name}] WebSocket connected`);
        this.emit("status", { 
          exchange: this.config.id, 
          status: "connected", 
          lastUpdate: Date.now() 
        });
        this.onConnected();
        this.startPing();
      });

      let msgCount = 0;
      
      this.ws.on("message", (data: WebSocket.Data) => {
        let messageStr: string | null = null;
        
        if (Buffer.isBuffer(data) || data instanceof ArrayBuffer) {
          const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
          if (buffer[0] === 0x1f && buffer[1] === 0x8b) {
            try {
              messageStr = zlib.gunzipSync(buffer).toString();
            } catch (e) {
              try {
                messageStr = zlib.inflateSync(buffer).toString();
              } catch (e2) {}
            }
          } else {
            messageStr = buffer.toString();
          }
        } else {
          messageStr = data.toString();
        }
        
        if (!messageStr) return;
        
        try {
          const message = JSON.parse(messageStr);
          if (["mexc", "coinex", "bingx"].includes(this.config.id) && msgCount < 5) {
            msgCount++;
            console.log(`[${this.config.name}] Msg #${msgCount}:`, messageStr.slice(0, 400));
          }
          this.handleMessage(message);
        } catch (e) {
          // Non-JSON message, skip
        }
      });

      this.ws.on("close", () => {
        this.isConnected = false;
        console.log(`[${this.config.name}] WebSocket disconnected`);
        this.emit("status", { 
          exchange: this.config.id, 
          status: "disconnected", 
          lastUpdate: Date.now() 
        });
        this.stopPing();
        this.scheduleReconnect();
      });

      this.ws.on("error", (error) => {
        console.error(`[${this.config.name}] WebSocket error:`, error.message);
        this.emit("status", { 
          exchange: this.config.id, 
          status: "error", 
          lastUpdate: Date.now(),
          errorMessage: error.message 
        });
      });
    } catch (e) {
      console.error(`[${this.config.name}] Failed to connect:`, e);
      this.scheduleReconnect();
    }
  }

  disconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopPing();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  subscribe(pairs: string[]): void {
    pairs.forEach(pair => this.subscribedPairs.add(pair));
    if (this.isConnected) {
      this.sendSubscribe(pairs);
    }
  }

  unsubscribe(pairs: string[]): void {
    pairs.forEach(pair => this.subscribedPairs.delete(pair));
    if (this.isConnected) {
      this.sendUnsubscribe(pairs);
    }
  }

  protected send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  protected scheduleReconnect(): void {
    if (this.reconnectTimeout) return;
    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, 5000);
  }

  protected startPing(): void {
    this.pingInterval = setInterval(() => {
      this.sendPing();
    }, 20000);
  }

  protected stopPing(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  protected emitTicker(ticker: Ticker): void {
    this.emit("ticker", ticker);
  }

  protected emitOrderBook(orderBook: OrderBook): void {
    this.emit("orderbook", orderBook);
  }

  // To be implemented by each exchange
  protected abstract onConnected(): void;
  protected abstract handleMessage(message: unknown): void;
  protected abstract sendSubscribe(pairs: string[]): void;
  protected abstract sendUnsubscribe(pairs: string[]): void;
  protected abstract sendPing(): void;
  
  // Convert exchange-specific symbol format
  abstract formatSymbol(pair: string): string;
  abstract parseSymbol(symbol: string): string;
}
