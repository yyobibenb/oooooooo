import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { 
  Activity, 
  TrendingUp, 
  TrendingDown, 
  Wifi, 
  WifiOff, 
  Bell, 
  Settings, 
  RefreshCw,
  ArrowRight,
  Send,
  Zap,
  DollarSign,
  BarChart3,
  Clock,
  Terminal,
  Radio,
  AlertTriangle,
  CheckCircle2,
  Search
} from "lucide-react";
import { 
  type Ticker, 
  type ArbitrageOpportunity, 
  type ConnectionStatus, 
  type Signal,
  type Settings as SettingsType,
  type WSMessage,
  type WSClientMessage,
  EXCHANGES,
  EXCHANGE_INFO,
  TRADING_PAIRS,
  type ExchangeId
} from "@shared/schema";
import { SettingsDialog } from "@/components/settings-dialog";
import { cn } from "@/lib/utils";

interface LogEntry {
  id: string;
  timestamp: number;
  type: "info" | "analysis" | "opportunity" | "signal" | "warning" | "error" | "connection";
  message: string;
  data?: {
    pair?: string;
    exchanges?: string[];
    prices?: { exchange: string; price: number }[];
    spread?: number;
    profit?: number;
  };
}

const formatPrice = (price: number): string => {
  if (price >= 1000) return price.toFixed(4);
  if (price >= 100) return price.toFixed(5);
  if (price >= 10) return price.toFixed(6);
  if (price >= 1) return price.toFixed(7);
  if (price >= 0.1) return price.toFixed(8);
  if (price >= 0.01) return price.toFixed(9);
  if (price >= 0.001) return price.toFixed(10);
  return price.toFixed(12);
};

export default function Dashboard() {
  const [tickers, setTickers] = useState<Map<string, Ticker>>(new Map());
  const [opportunities, setOpportunities] = useState<ArbitrageOpportunity[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [connectionStatuses, setConnectionStatuses] = useState<Map<ExchangeId, ConnectionStatus>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [settings, setSettings] = useState<SettingsType>({
    minProfitPercent: 1,
    enabledExchanges: [...EXCHANGES],
    enabledPairs: [...TRADING_PAIRS],
    telegramEnabled: true,
    soundEnabled: true,
    tradeAmount: 1000
  });
  const [selectedPair, setSelectedPair] = useState<string>("BTC/USDT");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [analysisStats, setAnalysisStats] = useState({
    totalAnalyzed: 0,
    opportunitiesFound: 0,
    lastAnalysis: Date.now()
  });
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const logIdRef = useRef(0);

  const addLog = useCallback((type: LogEntry["type"], message: string, data?: LogEntry["data"]) => {
    const entry: LogEntry = {
      id: `log-${logIdRef.current++}`,
      timestamp: Date.now(),
      type,
      message,
      data
    };
    setLogs(prev => [entry, ...prev].slice(0, 200));
  }, []);

  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    addLog("info", "Подключение к серверу...");
    
    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
        addLog("connection", "✅ Подключено к серверу арбитража");
        
        const message: WSClientMessage = {
          type: "subscribe",
          pairs: [...TRADING_PAIRS]
        };
        ws.send(JSON.stringify(message));
        addLog("info", `📡 Подписка на ${TRADING_PAIRS.length} торговых пар`);
      };

      ws.onmessage = (event) => {
        try {
          const message: WSMessage = JSON.parse(event.data);
          
          switch (message.type) {
            case "ticker":
              setTickers(prev => {
                const newMap = new Map(prev);
                const key = `${message.data.exchange}-${message.data.pair}`;
                newMap.set(key, message.data);
                return newMap;
              });
              
              // Log price updates periodically
              if (Math.random() < 0.02) {
                addLog("analysis", `📊 ${message.data.pair} на ${EXCHANGE_INFO[message.data.exchange].name}: $${formatPrice(message.data.ask)}`, {
                  pair: message.data.pair,
                  exchanges: [message.data.exchange]
                });
              }
              break;
              
            case "opportunity":
              setOpportunities(prev => {
                const filtered = prev.filter(o => o.id !== message.data.id);
                return [message.data, ...filtered].slice(0, 100);
              });
              
              setAnalysisStats(prev => ({
                ...prev,
                opportunitiesFound: prev.opportunitiesFound + 1
              }));
              
              addLog("opportunity", `🔥 АРБИТРАЖ: ${message.data.pair} | ${EXCHANGE_INFO[message.data.buyExchange].name} → ${EXCHANGE_INFO[message.data.sellExchange].name} | +${message.data.profitPercent.toFixed(4)}%`, {
                pair: message.data.pair,
                spread: message.data.spreadPercent,
                profit: message.data.profitPercent
              });
              break;
              
            case "signal":
              setSignals(prev => [message.data, ...prev].slice(0, 50));
              addLog("signal", `📨 Сигнал отправлен в Telegram: ${message.data.opportunity.pair} +${message.data.opportunity.profitPercent.toFixed(4)}%`);
              break;
              
            case "status":
              setConnectionStatuses(prev => {
                const newMap = new Map(prev);
                newMap.set(message.data.exchange, message.data);
                return newMap;
              });
              
              const statusEmoji = message.data.status === "connected" ? "✅" : 
                                  message.data.status === "connecting" ? "🔄" : "❌";
              addLog("connection", `${statusEmoji} ${EXCHANGE_INFO[message.data.exchange].name}: ${message.data.status}`);
              break;
              
            case "settings":
              setSettings(message.data);
              break;
              
            case "analysis":
              const analysisData = message.data as unknown as {
                pair: string;
                prices: { exchange: ExchangeId; price: number }[];
                bestBuy: { exchange: ExchangeId; price: number };
                bestSell: { exchange: ExchangeId; price: number };
                spread: number;
              };
              
              setAnalysisStats(prev => ({
                ...prev,
                totalAnalyzed: prev.totalAnalyzed + 1,
                lastAnalysis: Date.now()
              }));
              
              if (analysisData.spread >= 0.5) {
                addLog("analysis", `🔍 ${analysisData.pair}: Спред ${analysisData.spread.toFixed(4)}% (${EXCHANGE_INFO[analysisData.bestBuy.exchange].name} $${formatPrice(analysisData.bestBuy.price)} → ${EXCHANGE_INFO[analysisData.bestSell.exchange].name} $${formatPrice(analysisData.bestSell.price)})`, {
                  pair: analysisData.pair,
                  spread: analysisData.spread,
                  prices: analysisData.prices.map(p => ({ exchange: p.exchange, price: p.price }))
                });
              }
              break;
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message:", e);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        addLog("warning", "⚠️ Соединение потеряно, переподключение...");
        reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
      };

      ws.onerror = (error) => {
        addLog("error", "❌ Ошибка WebSocket");
      };
    } catch (e) {
      addLog("error", "❌ Не удалось подключиться к серверу");
      reconnectTimeoutRef.current = setTimeout(connectWebSocket, 3000);
    }
  }, [addLog]);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  // Periodic analysis logging
  useEffect(() => {
    const interval = setInterval(() => {
      const pairs = [...TRADING_PAIRS];
      const randomPair = pairs[Math.floor(Math.random() * pairs.length)];
      
      // Get prices for this pair
      const prices: { exchange: ExchangeId; price: number }[] = [];
      EXCHANGES.forEach(exchange => {
        const ticker = tickers.get(`${exchange}-${randomPair}`);
        if (ticker && ticker.ask > 0) {
          prices.push({ exchange, price: ticker.ask });
        }
      });
      
      if (prices.length >= 2) {
        prices.sort((a, b) => a.price - b.price);
        const lowest = prices[0];
        const highest = prices[prices.length - 1];
        const spread = ((highest.price - lowest.price) / lowest.price) * 100;
        
        setAnalysisStats(prev => ({
          ...prev,
          totalAnalyzed: prev.totalAnalyzed + 1,
          lastAnalysis: Date.now()
        }));
        
        if (spread >= 0.3) {
          addLog("analysis", `🔍 ${randomPair}: ${prices.length} бирж | Мин: ${EXCHANGE_INFO[lowest.exchange].name} $${formatPrice(lowest.price)} | Макс: ${EXCHANGE_INFO[highest.exchange].name} $${formatPrice(highest.price)} | Спред: ${spread.toFixed(4)}%`, {
            pair: randomPair,
            spread,
            prices: prices.map(p => ({ exchange: p.exchange, price: p.price }))
          });
        }
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [tickers, addLog]);

  const updateSettings = useCallback((newSettings: Partial<SettingsType>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WSClientMessage = {
        type: "updateSettings",
        settings: newSettings
      };
      wsRef.current.send(JSON.stringify(message));
    }
    setSettings(prev => ({ ...prev, ...newSettings }));
  }, []);

  const testTelegram = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const message: WSClientMessage = { type: "testTelegram" };
      wsRef.current.send(JSON.stringify(message));
      addLog("info", "📤 Отправка тестового сообщения в Telegram...");
    }
  }, [addLog]);

  const getPairPrices = useCallback((pair: string) => {
    const prices: { exchange: ExchangeId; ticker: Ticker }[] = [];
    EXCHANGES.forEach(exchange => {
      const ticker = tickers.get(`${exchange}-${pair}`);
      if (ticker) {
        prices.push({ exchange, ticker });
      }
    });
    return prices.sort((a, b) => a.ticker.ask - b.ticker.ask);
  }, [tickers]);

  const connectedCount = Array.from(connectionStatuses.values()).filter(
    s => s.status === "connected"
  ).length;

  const profitableOpportunities = opportunities.filter(
    o => o.profitPercent >= settings.minProfitPercent
  );

  const getLogIcon = (type: LogEntry["type"]) => {
    switch (type) {
      case "opportunity": return <Zap className="h-3 w-3 text-yellow-500" />;
      case "signal": return <Send className="h-3 w-3 text-blue-500" />;
      case "analysis": return <Search className="h-3 w-3 text-purple-500" />;
      case "connection": return <Radio className="h-3 w-3 text-green-500" />;
      case "warning": return <AlertTriangle className="h-3 w-3 text-orange-500" />;
      case "error": return <AlertTriangle className="h-3 w-3 text-red-500" />;
      default: return <Activity className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="flex h-14 items-center justify-between gap-4 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-chart-4" />
              <span className="font-semibold text-lg">CryptoArb</span>
            </div>
            <Badge 
              variant={wsConnected ? "default" : "destructive"} 
              className="gap-1"
              data-testid="status-ws-connection"
            >
              {wsConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
              {wsConnected ? "Live" : "Offline"}
            </Badge>
          </div>

          {/* Exchange Status */}
          <div className="hidden md:flex items-center gap-1.5">
            {EXCHANGES.map(exchange => {
              const status = connectionStatuses.get(exchange);
              const isConnected = status?.status === "connected";
              const info = EXCHANGE_INFO[exchange];
              
              return (
                <Tooltip key={exchange}>
                  <TooltipTrigger asChild>
                    <div 
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors",
                        isConnected 
                          ? "bg-chart-2/10 text-chart-2" 
                          : "bg-muted text-muted-foreground"
                      )}
                      data-testid={`status-exchange-${exchange}`}
                    >
                      <div className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        isConnected ? "bg-chart-2 animate-pulse" : "bg-muted-foreground"
                      )} />
                      <span className="hidden lg:inline">{info.name}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-sm">
                      <p className="font-medium">{info.name}</p>
                      <p className="text-muted-foreground">
                        {isConnected ? "Connected" : status?.status || "Disconnected"}
                      </p>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="gap-1 font-mono" data-testid="status-connected-count">
              <Activity className="h-3 w-3" />
              {connectedCount}/{EXCHANGES.length}
            </Badge>
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setSettingsOpen(true)}
              data-testid="button-settings"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="p-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card data-testid="card-stats-exchanges">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Биржи</p>
                  <p className="text-2xl font-bold font-mono text-chart-2">{connectedCount}/8</p>
                </div>
                <Radio className="h-8 w-8 text-chart-2 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stats-pairs">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Пар</p>
                  <p className="text-2xl font-bold font-mono">{TRADING_PAIRS.length}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-chart-3 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stats-analyzed">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Анализов</p>
                  <p className="text-2xl font-bold font-mono">{analysisStats.totalAnalyzed}</p>
                </div>
                <Search className="h-8 w-8 text-chart-3 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stats-opportunities">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Сигналов</p>
                  <p className="text-2xl font-bold font-mono text-chart-4">{analysisStats.opportunitiesFound}</p>
                </div>
                <Zap className="h-8 w-8 text-chart-4 opacity-50" />
              </div>
            </CardContent>
          </Card>
          
          <Card data-testid="card-stats-best-spread">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Лучший</p>
                  <p className="text-2xl font-bold font-mono text-chart-2">
                    +{profitableOpportunities[0]?.profitPercent.toFixed(4) || "0.0000"}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-chart-2 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - 2 columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Live Analysis Log */}
          <Card data-testid="card-live-log">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Terminal className="h-5 w-5 text-chart-3" />
                  Анализ в реальном времени
                </CardTitle>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-chart-2 animate-pulse" />
                  <span className="text-xs text-muted-foreground">Live</span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px] font-mono text-xs">
                <div className="space-y-1">
                  {logs.map((log) => (
                    <div
                      key={log.id}
                      className={cn(
                        "flex items-start gap-2 p-2 rounded-md transition-colors",
                        log.type === "opportunity" && "bg-yellow-500/10 border border-yellow-500/20",
                        log.type === "signal" && "bg-blue-500/10 border border-blue-500/20",
                        log.type === "error" && "bg-red-500/10",
                        log.type === "warning" && "bg-orange-500/10"
                      )}
                    >
                      <span className="text-muted-foreground shrink-0">
                        {new Date(log.timestamp).toLocaleTimeString()}
                      </span>
                      {getLogIcon(log.type)}
                      <span className={cn(
                        "flex-1",
                        log.type === "opportunity" && "text-yellow-500 font-medium",
                        log.type === "signal" && "text-blue-500",
                        log.type === "error" && "text-red-500"
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))}
                  {logs.length === 0 && (
                    <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                      <RefreshCw className="h-6 w-6 animate-spin mr-2" />
                      Подключение к биржам...
                    </div>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Arbitrage Opportunities */}
          <Card data-testid="card-opportunities">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-chart-4" />
                  Арбитражные сигналы
                </CardTitle>
                <Badge variant="outline" className="font-mono">
                  Min: {settings.minProfitPercent}%
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[400px]">
                {profitableOpportunities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                    <Search className="h-12 w-12 mb-4 opacity-30 animate-pulse" />
                    <p className="text-sm">Поиск арбитражных возможностей...</p>
                    <p className="text-xs">Порог прибыли: {settings.minProfitPercent}%</p>
                    <p className="text-xs mt-2">Анализируется {TRADING_PAIRS.length} пар на {connectedCount} биржах</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {profitableOpportunities.map((opp) => (
                      <div
                        key={opp.id}
                        className="flex flex-col p-3 rounded-lg bg-card border border-chart-2/30 hover-elevate transition-all"
                        data-testid={`opportunity-${opp.id}`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <Badge variant="outline" className="font-mono text-sm">
                            {opp.pair}
                          </Badge>
                          <Badge 
                            className={cn(
                              "font-mono text-sm",
                              opp.profitPercent >= 2 ? "bg-chart-2 text-white" : "bg-chart-2/20 text-chart-2"
                            )}
                          >
                            +{opp.profitPercent.toFixed(4)}%
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-sm mb-2">
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EXCHANGE_INFO[opp.buyExchange].color }} />
                            <span className="font-medium">{EXCHANGE_INFO[opp.buyExchange].name}</span>
                            <span className="text-muted-foreground font-mono">${formatPrice(opp.buyPrice)}</span>
                          </div>
                          <ArrowRight className="h-4 w-4 text-chart-2" />
                          <div className="flex items-center gap-1">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: EXCHANGE_INFO[opp.sellExchange].color }} />
                            <span className="font-medium">{EXCHANGE_INFO[opp.sellExchange].name}</span>
                            <span className="text-muted-foreground font-mono">${formatPrice(opp.sellPrice)}</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>Прибыль: ~${opp.estimatedProfit.toFixed(2)}</span>
                          <span>{new Date(opp.timestamp).toLocaleTimeString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>

        {/* Price Comparison Grid */}
        <Card data-testid="card-price-grid">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg">Цены на всех биржах</CardTitle>
              <Tabs defaultValue={selectedPair} onValueChange={setSelectedPair}>
                <TabsList className="h-8">
                  <TabsTrigger value="BTC/USDT" className="text-xs" data-testid="tab-btc">BTC</TabsTrigger>
                  <TabsTrigger value="ETH/USDT" className="text-xs" data-testid="tab-eth">ETH</TabsTrigger>
                  <TabsTrigger value="SOL/USDT" className="text-xs" data-testid="tab-sol">SOL</TabsTrigger>
                  <TabsTrigger value="XRP/USDT" className="text-xs" data-testid="tab-xrp">XRP</TabsTrigger>
                  <TabsTrigger value="DOGE/USDT" className="text-xs" data-testid="tab-doge">DOGE</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2">
              {EXCHANGES.map(exchange => {
                const ticker = tickers.get(`${exchange}-${selectedPair}`);
                const info = EXCHANGE_INFO[exchange];
                const allPrices = getPairPrices(selectedPair);
                const isLowest = allPrices[0]?.exchange === exchange;
                const isHighest = allPrices.length > 0 && allPrices[allPrices.length - 1]?.exchange === exchange;
                
                return (
                  <div
                    key={exchange}
                    className={cn(
                      "p-3 rounded-lg border text-center transition-all",
                      isLowest && "border-chart-2 bg-chart-2/5",
                      isHighest && "border-chart-5 bg-chart-5/5",
                      !isLowest && !isHighest && "border-muted"
                    )}
                    data-testid={`price-card-${exchange}`}
                  >
                    <div className="flex items-center justify-center gap-1 mb-1">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: info.color }} />
                      <span className="text-xs font-medium">{info.name}</span>
                    </div>
                    {ticker ? (
                      <>
                        <p className="font-mono font-bold text-sm">
                          ${formatPrice(ticker.ask)}
                        </p>
                        <p className={cn(
                          "text-xs font-mono",
                          ticker.change24h >= 0 ? "text-chart-2" : "text-destructive"
                        )}>
                          {ticker.change24h >= 0 ? "+" : ""}{ticker.change24h.toFixed(2)}%
                        </p>
                        {isLowest && <Badge className="mt-1 text-[10px] bg-chart-2">LOW</Badge>}
                        {isHighest && <Badge className="mt-1 text-[10px] bg-chart-5">HIGH</Badge>}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Loading...</p>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* All Pairs Analysis */}
        <Card data-testid="card-all-pairs">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Все торговые пары ({TRADING_PAIRS.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10 gap-2">
              {TRADING_PAIRS.map(pair => {
                const prices = getPairPrices(pair);
                const lowestPrice = prices[0]?.ticker?.ask;
                const highestPrice = prices[prices.length - 1]?.ticker?.ask;
                const spread = lowestPrice && highestPrice 
                  ? ((highestPrice - lowestPrice) / lowestPrice * 100) 
                  : 0;
                const exchangeCount = prices.length;
                
                return (
                  <div
                    key={pair}
                    className={cn(
                      "p-2 rounded-md border text-center cursor-pointer transition-all hover-elevate",
                      spread >= 1 && "border-chart-2 bg-chart-2/10",
                      spread >= 0.5 && spread < 1 && "border-chart-4/50 bg-chart-4/5"
                    )}
                    onClick={() => setSelectedPair(pair)}
                    data-testid={`pair-card-${pair.replace("/", "-")}`}
                  >
                    <p className="text-xs font-medium truncate">{pair.replace("/USDT", "")}</p>
                    {lowestPrice ? (
                      <>
                        <p className="font-mono text-xs">
                          ${formatPrice(lowestPrice)}
                        </p>
                        <p className={cn(
                          "text-[10px] font-mono font-medium",
                          spread >= 1 ? "text-chart-2" : spread >= 0.5 ? "text-chart-4" : "text-muted-foreground"
                        )}>
                          {spread >= 0.01 ? `${spread.toFixed(4)}%` : "—"}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{exchangeCount}/8</p>
                      </>
                    ) : (
                      <RefreshCw className="h-3 w-3 mx-auto mt-1 animate-spin text-muted-foreground" />
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Signal History */}
        <Card data-testid="card-signal-history">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <Bell className="h-5 w-5" />
                История сигналов Telegram
              </CardTitle>
              <Button 
                variant="outline" 
                size="sm"
                onClick={testTelegram}
                data-testid="button-test-telegram"
              >
                <Send className="h-3 w-3 mr-1" />
                Тест
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {signals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground text-sm">
                <Bell className="h-8 w-8 mb-2 opacity-30" />
                <p>Сигналы будут отправлены при прибыли &gt; {settings.minProfitPercent}%</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                {signals.slice(0, 9).map((signal) => (
                  <div
                    key={signal.id}
                    className="p-3 rounded-md bg-card border text-sm"
                    data-testid={`signal-${signal.id}`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline">{signal.opportunity.pair}</Badge>
                      <Badge className="bg-chart-2/20 text-chart-2">
                        +{signal.opportunity.profitPercent.toFixed(4)}%
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {EXCHANGE_INFO[signal.opportunity.buyExchange].name} → {EXCHANGE_INFO[signal.opportunity.sellExchange].name}
                    </div>
                    <div className="flex items-center justify-between mt-2 text-xs">
                      <span className="flex items-center gap-1 text-chart-2">
                        <CheckCircle2 className="h-3 w-3" />
                        Доставлено
                      </span>
                      <span className="text-muted-foreground">
                        {new Date(signal.sentAt).toLocaleTimeString()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <SettingsDialog 
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        settings={settings}
        onUpdateSettings={updateSettings}
        onTestTelegram={testTelegram}
      />
    </div>
  );
}
