import crypto from "crypto";

interface MexcConfig {
  apiKey: string;
  secretKey: string;
  baseUrl: string;
}

interface MexcTicker {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  lastPrice: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  volume: string;
  quoteVolume: string;
}

interface MexcOrderBookEntry {
  price: string;
  quantity: string;
}

interface MexcOrderBook {
  bids: [string, string][];
  asks: [string, string][];
}

interface MexcBalance {
  asset: string;
  free: string;
  locked: string;
}

interface MexcOrder {
  symbol: string;
  orderId: string;
  clientOrderId: string;
  price: string;
  origQty: string;
  executedQty: string;
  status: string;
  type: string;
  side: string;
}

export class MexcApiService {
  private config: MexcConfig;

  constructor() {
    this.config = {
      apiKey: process.env.MEXC_API_KEY || "",
      secretKey: process.env.MEXC_SECRET_KEY || "",
      baseUrl: "https://api.mexc.com"
    };

    if (this.config.apiKey && this.config.secretKey) {
      console.log("[MEXC API] Initialized with API credentials");
    } else {
      console.log("[MEXC API] Running in public mode (no API keys)");
    }
  }

  private generateSignature(queryString: string): string {
    return crypto
      .createHmac("sha256", this.config.secretKey)
      .update(queryString)
      .digest("hex");
  }

  private async publicRequest<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
    const queryString = new URLSearchParams(params).toString();
    const url = `${this.config.baseUrl}${endpoint}${queryString ? "?" + queryString : ""}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`MEXC API error: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<T>;
  }

  private async signedRequest<T>(
    method: "GET" | "POST" | "DELETE",
    endpoint: string,
    params: Record<string, string> = {}
  ): Promise<T> {
    if (!this.config.apiKey || !this.config.secretKey) {
      throw new Error("MEXC API credentials not configured");
    }

    const timestamp = Date.now().toString();
    const allParams = { ...params, timestamp };
    const queryString = new URLSearchParams(allParams).toString();
    const signature = this.generateSignature(queryString);
    
    const url = `${this.config.baseUrl}${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method,
      headers: {
        "Content-Type": "application/json",
        "X-MEXC-APIKEY": this.config.apiKey
      }
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`MEXC API error: ${response.status} - ${error}`);
    }

    return response.json() as Promise<T>;
  }

  async getTicker(symbol: string): Promise<MexcTicker> {
    const formattedSymbol = symbol.replace("/", "").toUpperCase();
    return this.publicRequest<MexcTicker>("/api/v3/ticker/24hr", { symbol: formattedSymbol });
  }

  async getAllTickers(): Promise<MexcTicker[]> {
    return this.publicRequest<MexcTicker[]>("/api/v3/ticker/24hr");
  }

  async getOrderBook(symbol: string, limit: number = 20): Promise<MexcOrderBook> {
    const formattedSymbol = symbol.replace("/", "").toUpperCase();
    return this.publicRequest<MexcOrderBook>("/api/v3/depth", { 
      symbol: formattedSymbol, 
      limit: limit.toString() 
    });
  }

  async getPrice(symbol: string): Promise<{ symbol: string; price: string }> {
    const formattedSymbol = symbol.replace("/", "").toUpperCase();
    return this.publicRequest<{ symbol: string; price: string }>("/api/v3/ticker/price", { 
      symbol: formattedSymbol 
    });
  }

  async getBalances(): Promise<MexcBalance[]> {
    const response = await this.signedRequest<{ balances: MexcBalance[] }>("GET", "/api/v3/account");
    return response.balances.filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0);
  }

  async getBalance(asset: string): Promise<MexcBalance | null> {
    const balances = await this.getBalances();
    return balances.find(b => b.asset.toUpperCase() === asset.toUpperCase()) || null;
  }

  async placeOrder(params: {
    symbol: string;
    side: "BUY" | "SELL";
    type: "LIMIT" | "MARKET";
    quantity: string;
    price?: string;
    timeInForce?: "GTC" | "IOC" | "FOK";
  }): Promise<MexcOrder> {
    if (!params.symbol || !params.side || !params.type || !params.quantity) {
      throw new Error("Missing required order parameters: symbol, side, type, quantity");
    }

    if (params.type === "LIMIT" && !params.price) {
      throw new Error("Price is required for LIMIT orders");
    }

    const orderParams: Record<string, string> = {
      symbol: params.symbol.replace("/", "").toUpperCase(),
      side: params.side,
      type: params.type,
      quantity: params.quantity
    };

    if (params.type === "LIMIT") {
      orderParams.price = params.price!;
      orderParams.timeInForce = params.timeInForce || "GTC";
    }

    return this.signedRequest<MexcOrder>("POST", "/api/v3/order", orderParams);
  }

  async cancelOrder(symbol: string, orderId: string): Promise<MexcOrder> {
    return this.signedRequest<MexcOrder>("DELETE", "/api/v3/order", {
      symbol: symbol.replace("/", "").toUpperCase(),
      orderId
    });
  }

  async getOpenOrders(symbol?: string): Promise<MexcOrder[]> {
    const params: Record<string, string> = {};
    if (symbol) {
      params.symbol = symbol.replace("/", "").toUpperCase();
    }
    return this.signedRequest<MexcOrder[]>("GET", "/api/v3/openOrders", params);
  }

  async getOrder(symbol: string, orderId: string): Promise<MexcOrder> {
    return this.signedRequest<MexcOrder>("GET", "/api/v3/order", {
      symbol: symbol.replace("/", "").toUpperCase(),
      orderId
    });
  }

  async getServerTime(): Promise<number> {
    const response = await this.publicRequest<{ serverTime: number }>("/api/v3/time");
    return response.serverTime;
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.getServerTime();
      return true;
    } catch {
      return false;
    }
  }

  isConfigured(): boolean {
    return !!(this.config.apiKey && this.config.secretKey);
  }
}

export const mexcApi = new MexcApiService();
