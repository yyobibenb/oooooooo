import type { Express } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { createExchange, BaseExchange } from "./exchanges";
import { ArbitrageEngine } from "./services/arbitrage";
import { TelegramService } from "./services/telegram";
import { mexcApi } from "./services/mexc-api";
import type { 
  WSMessage, 
  WSClientMessage, 
  ConnectionStatus,
  ArbitrageOpportunity,
  Signal,
  Ticker
} from "@shared/schema";
import { EXCHANGES, TRADING_PAIRS, type ExchangeId } from "@shared/schema";

const SITE_PASSWORD = process.env.SITE_PASSWORD || "admin";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  const arbitrageEngine = new ArbitrageEngine();
  const telegramService = new TelegramService();
  const exchanges: Map<ExchangeId, BaseExchange> = new Map();
  const signals: Signal[] = [];
  const opportunities: ArbitrageOpportunity[] = [];
  const tickerCounts: Map<ExchangeId, number> = new Map();
  
  // Log ticker counts every 10 seconds
  setInterval(() => {
    const counts: string[] = [];
    EXCHANGES.forEach(ex => {
      const count = tickerCounts.get(ex) || 0;
      counts.push(`${ex}: ${count}`);
    });
    console.log(`[Tickers] ${counts.join(" | ")}`);
  }, 10000);

  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });

  function broadcast(message: WSMessage | { type: string; data: unknown }): void {
    const data = JSON.stringify(message);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  }

  function initializeExchanges(): void {
    console.log("[Server] 🚀 Initializing 8 exchanges...");
    console.log("[Server] 📊 Monitoring", TRADING_PAIRS.length, "trading pairs");
    
    for (const exchangeId of EXCHANGES) {
      try {
        const exchange = createExchange(exchangeId);
        exchanges.set(exchangeId, exchange);

        exchange.on("ticker", (ticker: Ticker) => {
          broadcast({ type: "ticker", data: ticker });
          arbitrageEngine.updateTicker(ticker);
          tickerCounts.set(exchangeId, (tickerCounts.get(exchangeId) || 0) + 1);
        });

        exchange.on("status", (status: ConnectionStatus) => {
          broadcast({ type: "status", data: status });
          console.log(`[${exchangeId}] Status: ${status.status}`);
        });

        exchange.connect();
        exchange.subscribe([...TRADING_PAIRS]);

        console.log(`[Server] ✅ ${exchangeId} initialized`);
      } catch (error) {
        console.error(`[Server] ❌ Failed to initialize ${exchangeId}:`, error);
      }
    }
  }

  // Handle analysis results
  arbitrageEngine.on("analysis", (analysis) => {
    broadcast({ type: "analysis", data: analysis });
  });

  // Handle arbitrage opportunities
  arbitrageEngine.on("opportunity", async (opportunity: ArbitrageOpportunity) => {
    opportunities.unshift(opportunity);
    if (opportunities.length > 100) opportunities.pop();

    broadcast({ type: "opportunity", data: opportunity });

    const settings = arbitrageEngine.getSettings();
    if (settings.telegramEnabled && telegramService.isConfigured()) {
      console.log(`[Telegram] 📤 Sending signal for ${opportunity.pair}...`);
      const signal = await telegramService.sendOpportunity(opportunity);
      if (signal) {
        signals.unshift(signal);
        if (signals.length > 50) signals.pop();
        broadcast({ type: "signal", data: signal });
        console.log(`[Telegram] ✅ Signal sent for ${opportunity.pair}`);
      }
    } else if (settings.telegramEnabled && !telegramService.isConfigured()) {
      console.log(`[Telegram] ⚠️ Bot not configured - signal not sent`);
    }
  });

  arbitrageEngine.updateSettings({
    minProfitPercent: 1,
    enabledExchanges: [...EXCHANGES],
    enabledPairs: [...TRADING_PAIRS],
    telegramEnabled: true,
    soundEnabled: true,
    tradeAmount: 1000
  });

  wss.on("connection", (ws: WebSocket) => {
    console.log("[WS] 👤 Client connected");

    const settings = arbitrageEngine.getSettings();
    ws.send(JSON.stringify({ type: "settings", data: settings }));

    exchanges.forEach((exchange, exchangeId) => {
      const status = exchange.getStatus();
      ws.send(JSON.stringify({ type: "status", data: status }));
    });

    opportunities.forEach((opp) => {
      ws.send(JSON.stringify({ type: "opportunity", data: opp }));
    });

    signals.forEach((signal) => {
      ws.send(JSON.stringify({ type: "signal", data: signal }));
    });

    ws.on("message", async (data: Buffer) => {
      try {
        const message: WSClientMessage = JSON.parse(data.toString());

        switch (message.type) {
          case "subscribe":
            break;

          case "updateSettings":
            if (message.settings) {
              arbitrageEngine.updateSettings(message.settings);
              telegramService.setEnabled(message.settings.telegramEnabled ?? true);
              
              const newSettings = arbitrageEngine.getSettings();
              broadcast({ type: "settings", data: newSettings });
              console.log("[Settings] Updated:", message.settings);
            }
            break;

          case "testTelegram":
            console.log("[Telegram] 🧪 Sending test message...");
            const result = await telegramService.sendTestMessage();
            if (result.success) {
              console.log("[Telegram] ✅ Test message sent");
              ws.send(JSON.stringify({ 
                type: "signal", 
                data: {
                  id: "test",
                  opportunity: {
                    id: "test",
                    pair: "TEST",
                    buyExchange: "bybit",
                    sellExchange: "okx",
                    buyPrice: 0,
                    sellPrice: 0,
                    spreadPercent: 0,
                    profitPercent: 0,
                    estimatedProfit: 0,
                    volume: 0,
                    buyFee: 0,
                    sellFee: 0,
                    timestamp: Date.now()
                  },
                  sentAt: Date.now(),
                  delivered: true
                }
              }));
            } else {
              console.log("[Telegram] ❌ Test failed:", result.error);
            }
            break;
        }
      } catch (error) {
        console.error("[WS] Error handling message:", error);
      }
    });

    ws.on("close", () => {
      console.log("[WS] 👤 Client disconnected");
    });
  });

  app.get("/api/status", (_req, res) => {
    const status = {
      exchanges: Array.from(exchanges.entries()).map(([id]) => ({
        id,
        connected: true
      })),
      telegramConfigured: telegramService.isConfigured(),
      settings: arbitrageEngine.getSettings(),
      analysisCount: arbitrageEngine.getAnalysisCount()
    };
    res.json(status);
  });

  app.get("/api/opportunities", (_req, res) => {
    res.json(opportunities);
  });

  app.get("/api/signals", (_req, res) => {
    res.json(signals);
  });

  // MEXC API Routes
  // Authentication middleware for protected routes
  const requireMexcAuth = (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    const expectedToken = process.env.MEXC_ACCESS_TOKEN;
    
    if (!expectedToken) {
      return res.status(503).json({ 
        error: "Trading API not configured. Set MEXC_ACCESS_TOKEN environment variable." 
      });
    }
    
    if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
      return res.status(401).json({ error: "Unauthorized. Provide valid Bearer token." });
    }
    
    next();
  };

  app.get("/api/mexc/status", async (_req, res) => {
    try {
      const connected = await mexcApi.testConnection();
      res.json({ 
        connected, 
        configured: mexcApi.isConfigured(),
        message: mexcApi.isConfigured() 
          ? "MEXC API configured" 
          : "MEXC API running in public mode (no trading)"
      });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/ticker/:symbol", async (req, res) => {
    try {
      const ticker = await mexcApi.getTicker(req.params.symbol);
      res.json(ticker);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/tickers", async (_req, res) => {
    try {
      const tickers = await mexcApi.getAllTickers();
      res.json(tickers);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/orderbook/:symbol", async (req, res) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const orderbook = await mexcApi.getOrderBook(req.params.symbol, limit);
      res.json(orderbook);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/price/:symbol", async (req, res) => {
    try {
      const price = await mexcApi.getPrice(req.params.symbol);
      res.json(price);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  // Protected routes - require authentication token
  app.get("/api/mexc/balances", requireMexcAuth, async (_req, res) => {
    try {
      if (!mexcApi.isConfigured()) {
        return res.status(401).json({ error: "MEXC API not configured. Set MEXC_API_KEY and MEXC_SECRET_KEY" });
      }
      const balances = await mexcApi.getBalances();
      res.json(balances);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/balance/:asset", requireMexcAuth, async (req, res) => {
    try {
      if (!mexcApi.isConfigured()) {
        return res.status(401).json({ error: "MEXC API not configured" });
      }
      const balance = await mexcApi.getBalance(req.params.asset);
      res.json(balance || { asset: req.params.asset, free: "0", locked: "0" });
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/mexc/order", requireMexcAuth, async (req, res) => {
    try {
      if (!mexcApi.isConfigured()) {
        return res.status(401).json({ error: "MEXC API not configured" });
      }
      const { symbol, side, type, quantity, price, timeInForce } = req.body;
      const order = await mexcApi.placeOrder({ symbol, side, type, quantity, price, timeInForce });
      console.log(`[MEXC] Order placed: ${side} ${quantity} ${symbol} @ ${price || 'MARKET'}`);
      res.json(order);
    } catch (error) {
      console.error(`[MEXC] Order failed:`, error);
      res.status(500).json({ error: String(error) });
    }
  });

  app.delete("/api/mexc/order/:symbol/:orderId", requireMexcAuth, async (req, res) => {
    try {
      if (!mexcApi.isConfigured()) {
        return res.status(401).json({ error: "MEXC API not configured" });
      }
      const result = await mexcApi.cancelOrder(req.params.symbol, req.params.orderId);
      console.log(`[MEXC] Order cancelled: ${req.params.orderId}`);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.get("/api/mexc/orders/:symbol?", requireMexcAuth, async (req, res) => {
    try {
      if (!mexcApi.isConfigured()) {
        return res.status(401).json({ error: "MEXC API not configured" });
      }
      const orders = await mexcApi.getOpenOrders(req.params.symbol);
      res.json(orders);
    } catch (error) {
      res.status(500).json({ error: String(error) });
    }
  });

  app.post("/api/auth/login", (req, res) => {
    const { password } = req.body;
    if (password === SITE_PASSWORD) {
      res.json({ success: true });
    } else {
      res.status(401).json({ success: false, error: "Invalid password" });
    }
  });

  app.post("/api/auth/verify", (req, res) => {
    const { token } = req.body;
    if (token === SITE_PASSWORD) {
      res.json({ valid: true });
    } else {
      res.status(401).json({ valid: false });
    }
  });

  app.get("/api/health", (_req, res) => {
    res.json({ 
      status: "ok", 
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  });

  setTimeout(() => {
    initializeExchanges();
  }, 1000);

  return httpServer;
}
