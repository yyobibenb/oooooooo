import { z } from "zod";

// Exchange identifiers
export const EXCHANGES = [
  "bybit",
  "okx", 
  "mexc",
  "bitget",
  "gateio",
  "kucoin",
  "coinex",
  "bingx"
] as const;

export type ExchangeId = typeof EXCHANGES[number];

// Exchange display info
export const EXCHANGE_INFO: Record<ExchangeId, { name: string; color: string; makerFee: number; takerFee: number }> = {
  bybit: { name: "Bybit", color: "#F7A600", makerFee: 0.001, takerFee: 0.001 },
  okx: { name: "OKX", color: "#121212", makerFee: 0.0008, takerFee: 0.001 },
  mexc: { name: "MEXC", color: "#00B897", makerFee: 0.0, takerFee: 0.001 },
  bitget: { name: "Bitget", color: "#00F0FF", makerFee: 0.001, takerFee: 0.001 },
  gateio: { name: "Gate.io", color: "#17E6A1", makerFee: 0.002, takerFee: 0.002 },
  kucoin: { name: "KuCoin", color: "#24AE8F", makerFee: 0.001, takerFee: 0.001 },
  coinex: { name: "CoinEx", color: "#4285F4", makerFee: 0.002, takerFee: 0.002 },
  bingx: { name: "BingX", color: "#2B6AF5", makerFee: 0.001, takerFee: 0.001 }
};

// Popular trading pairs - focus on major altcoins
export const TRADING_PAIRS = [
  "BTC/USDT",
  "ETH/USDT",
  "BNB/USDT",
  "XRP/USDT",
  "SOL/USDT",
  "ADA/USDT",
  "DOGE/USDT",
  "AVAX/USDT",
  "DOT/USDT",
  "LINK/USDT",
  "ATOM/USDT",
  "LTC/USDT",
  "UNI/USDT",
  "XLM/USDT",
  "NEAR/USDT",
  "APT/USDT",
  "ARB/USDT",
  "OP/USDT",
  "FIL/USDT",
  "PEPE/USDT",
  "SHIB/USDT",
  "TRX/USDT",
  "BCH/USDT",
  "ETC/USDT",
  "INJ/USDT",
  "SUI/USDT",
  "SEI/USDT",
  "TIA/USDT",
  "RENDER/USDT",
  "FET/USDT",
  "AAVE/USDT",
  "ALGO/USDT",
  "CRV/USDT",
  "SAND/USDT",
  "MANA/USDT",
  "GRT/USDT",
  "IMX/USDT",
  "EGLD/USDT",
  "FLOW/USDT",
  "THETA/USDT",
  "GALA/USDT",
  "AXS/USDT",
  "ENJ/USDT",
  "CHZ/USDT",
  "MASK/USDT",
  "1INCH/USDT",
  "COMP/USDT",
  "SNX/USDT",
  "LDO/USDT",
  "BLUR/USDT",
  "WLD/USDT",
  "PENDLE/USDT",
  "STX/USDT",
  "ORDI/USDT",
  "WOO/USDT",
  "RUNE/USDT",
  "KAS/USDT",
  "TON/USDT",
  "JUP/USDT",
  "PYTH/USDT",
  "ONDO/USDT",
  "STRK/USDT",
  "MANTA/USDT",
  "DYM/USDT",
  "ALT/USDT",
  "PIXEL/USDT",
  "PORTAL/USDT",
  "AEVO/USDT",
  "ENA/USDT",
  "W/USDT",
  "ETHFI/USDT",
  "BOME/USDT",
  "WIF/USDT",
  "BONK/USDT",
  "FLOKI/USDT",
  "MEME/USDT",
  "TURBO/USDT",
  "PEOPLE/USDT",
  "CFX/USDT",
  "FTM/USDT",
  "KAVA/USDT",
  "ZIL/USDT",
  "VET/USDT",
  "HBAR/USDT",
  "ICP/USDT",
  "QNT/USDT",
  "MKR/USDT",
  "RPL/USDT",
  "SSV/USDT",
  "FXS/USDT",
  "GMX/USDT",
  "DYDX/USDT",
  "ZRX/USDT",
  "SUSHI/USDT",
  "BAL/USDT",
  "YFI/USDT",
  "LQTY/USDT",
  "API3/USDT",
  "BAND/USDT",
  "REN/USDT",
  "OCEAN/USDT",
  "AGIX/USDT",
  "RNDR/USDT",
  "AR/USDT",
  "STORJ/USDT",
  "ANKR/USDT",
  "SUPER/USDT",
  "HIGH/USDT",
  "MAGIC/USDT",
  "PRIME/USDT",
  "RONIN/USDT",
  "CYBER/USDT",
  "ID/USDT",
  "ARKM/USDT",
  "CAKE/USDT"
] as const;

export type TradingPair = typeof TRADING_PAIRS[number];

// Price ticker from exchange
export const tickerSchema = z.object({
  exchange: z.enum(EXCHANGES),
  pair: z.string(),
  bid: z.number(),
  ask: z.number(),
  last: z.number(),
  volume24h: z.number(),
  change24h: z.number(),
  timestamp: z.number()
});

export type Ticker = z.infer<typeof tickerSchema>;

// Order book entry
export const orderBookEntrySchema = z.object({
  price: z.number(),
  amount: z.number()
});

export type OrderBookEntry = z.infer<typeof orderBookEntrySchema>;

// Order book data
export const orderBookSchema = z.object({
  exchange: z.enum(EXCHANGES),
  pair: z.string(),
  bids: z.array(orderBookEntrySchema),
  asks: z.array(orderBookEntrySchema),
  timestamp: z.number()
});

export type OrderBook = z.infer<typeof orderBookSchema>;

// Arbitrage opportunity
export const arbitrageOpportunitySchema = z.object({
  id: z.string(),
  pair: z.string(),
  buyExchange: z.enum(EXCHANGES),
  sellExchange: z.enum(EXCHANGES),
  buyPrice: z.number(),
  sellPrice: z.number(),
  spreadPercent: z.number(),
  profitPercent: z.number(),
  estimatedProfit: z.number(),
  volume: z.number(),
  buyFee: z.number(),
  sellFee: z.number(),
  timestamp: z.number()
});

export type ArbitrageOpportunity = z.infer<typeof arbitrageOpportunitySchema>;

// Signal sent to Telegram
export const signalSchema = z.object({
  id: z.string(),
  opportunity: arbitrageOpportunitySchema,
  sentAt: z.number(),
  delivered: z.boolean(),
  telegramMessageId: z.string().optional()
});

export type Signal = z.infer<typeof signalSchema>;

// Exchange connection status
export const connectionStatusSchema = z.object({
  exchange: z.enum(EXCHANGES),
  status: z.enum(["connected", "connecting", "disconnected", "error"]),
  lastUpdate: z.number(),
  errorMessage: z.string().optional()
});

export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

// Network info for deposits/withdrawals
export const networkInfoSchema = z.object({
  network: z.string(),
  coin: z.string(),
  withdrawEnabled: z.boolean(),
  depositEnabled: z.boolean(),
  minWithdraw: z.number(),
  withdrawFee: z.number(),
  confirmations: z.number()
});

export type NetworkInfo = z.infer<typeof networkInfoSchema>;

// Settings for the arbitrage scanner
export const settingsSchema = z.object({
  minProfitPercent: z.number().min(0).max(100).default(1),
  enabledExchanges: z.array(z.enum(EXCHANGES)).default([...EXCHANGES]),
  enabledPairs: z.array(z.string()).default([...TRADING_PAIRS]),
  telegramEnabled: z.boolean().default(true),
  soundEnabled: z.boolean().default(true),
  tradeAmount: z.number().min(10).default(1000)
});

export type Settings = z.infer<typeof settingsSchema>;

// WebSocket message types
export type WSMessage = 
  | { type: "ticker"; data: Ticker }
  | { type: "orderbook"; data: OrderBook }
  | { type: "opportunity"; data: ArbitrageOpportunity }
  | { type: "signal"; data: Signal }
  | { type: "status"; data: ConnectionStatus }
  | { type: "settings"; data: Settings }
  | { type: "error"; message: string };

// Client to server messages
export type WSClientMessage =
  | { type: "subscribe"; pairs: string[] }
  | { type: "unsubscribe"; pairs: string[] }
  | { type: "updateSettings"; settings: Partial<Settings> }
  | { type: "testTelegram" };

// Legacy user types (keeping for compatibility)
export const users = {
  id: "",
  username: "",
  password: ""
};

export type InsertUser = { username: string; password: string };
export type User = { id: string; username: string; password: string };
