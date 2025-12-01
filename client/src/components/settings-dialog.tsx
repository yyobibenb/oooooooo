import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Bell, 
  DollarSign, 
  Send,
  Check,
  X
} from "lucide-react";
import { 
  type Settings as SettingsType,
  EXCHANGES,
  EXCHANGE_INFO,
  TRADING_PAIRS,
  type ExchangeId
} from "@shared/schema";
import { cn } from "@/lib/utils";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: SettingsType;
  onUpdateSettings: (settings: Partial<SettingsType>) => void;
  onTestTelegram: () => void;
}

export function SettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onTestTelegram
}: SettingsDialogProps) {
  const [localSettings, setLocalSettings] = useState<SettingsType>(settings);

  const handleSave = () => {
    onUpdateSettings(localSettings);
    onOpenChange(false);
  };

  const toggleExchange = (exchange: ExchangeId) => {
    const current = localSettings.enabledExchanges;
    const updated = current.includes(exchange)
      ? current.filter(e => e !== exchange)
      : [...current, exchange];
    setLocalSettings({ ...localSettings, enabledExchanges: updated as ExchangeId[] });
  };

  const togglePair = (pair: string) => {
    const current = localSettings.enabledPairs;
    const updated = current.includes(pair)
      ? current.filter(p => p !== pair)
      : [...current, pair];
    setLocalSettings({ ...localSettings, enabledPairs: updated });
  };

  const toggleAllPairs = (enabled: boolean) => {
    setLocalSettings({
      ...localSettings,
      enabledPairs: enabled ? [...TRADING_PAIRS] : []
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Settings
          </DialogTitle>
          <DialogDescription>
            Configure arbitrage scanner parameters and notifications
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="general" data-testid="tab-settings-general">General</TabsTrigger>
            <TabsTrigger value="exchanges" data-testid="tab-settings-exchanges">Exchanges</TabsTrigger>
            <TabsTrigger value="pairs" data-testid="tab-settings-pairs">Trading Pairs</TabsTrigger>
          </TabsList>

          <TabsContent value="general" className="space-y-6 mt-4">
            {/* Profit Threshold */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4 text-chart-4" />
                  Minimum Profit Threshold
                </Label>
                <Badge variant="outline" className="font-mono">
                  {localSettings.minProfitPercent}%
                </Badge>
              </div>
              <Slider
                value={[localSettings.minProfitPercent]}
                onValueChange={([value]) => 
                  setLocalSettings({ ...localSettings, minProfitPercent: value })
                }
                min={0.1}
                max={5}
                step={0.1}
                className="w-full"
                data-testid="slider-min-profit"
              />
              <p className="text-xs text-muted-foreground">
                Only show opportunities with profit above this threshold
              </p>
            </div>

            {/* Trade Amount */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-chart-1" />
                Trade Amount (USDT)
              </Label>
              <Input
                type="number"
                value={localSettings.tradeAmount}
                onChange={(e) => 
                  setLocalSettings({ ...localSettings, tradeAmount: Number(e.target.value) })
                }
                min={10}
                max={1000000}
                data-testid="input-trade-amount"
              />
              <p className="text-xs text-muted-foreground">
                Used to calculate estimated profit in USDT
              </p>
            </div>

            {/* Telegram Settings */}
            <div className="space-y-4 p-4 rounded-lg border bg-card">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Bell className="h-4 w-4 text-chart-1" />
                  <Label>Telegram Notifications</Label>
                </div>
                <Switch
                  checked={localSettings.telegramEnabled}
                  onCheckedChange={(checked) =>
                    setLocalSettings({ ...localSettings, telegramEnabled: checked })
                  }
                  data-testid="switch-telegram"
                />
              </div>
              
              {localSettings.telegramEnabled && (
                <div className="space-y-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={onTestTelegram}
                    className="w-full"
                    data-testid="button-test-telegram-settings"
                  >
                    <Send className="h-4 w-4 mr-2" />
                    Send Test Message
                  </Button>
                  <p className="text-xs text-muted-foreground text-center">
                    Sends a test signal to verify Telegram configuration
                  </p>
                </div>
              )}
            </div>

            {/* Sound Settings */}
            <div className="flex items-center justify-between p-4 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4" />
                <Label>Sound Alerts</Label>
              </div>
              <Switch
                checked={localSettings.soundEnabled}
                onCheckedChange={(checked) =>
                  setLocalSettings({ ...localSettings, soundEnabled: checked })
                }
                data-testid="switch-sound"
              />
            </div>
          </TabsContent>

          <TabsContent value="exchanges" className="mt-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm text-muted-foreground">
                  Select exchanges to monitor
                </p>
                <Badge variant="outline">
                  {localSettings.enabledExchanges.length}/{EXCHANGES.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {EXCHANGES.map(exchange => {
                  const info = EXCHANGE_INFO[exchange];
                  const isEnabled = localSettings.enabledExchanges.includes(exchange);
                  
                  return (
                    <button
                      key={exchange}
                      onClick={() => toggleExchange(exchange)}
                      className={cn(
                        "flex items-center justify-between p-3 rounded-lg border transition-all",
                        isEnabled 
                          ? "border-chart-2/50 bg-chart-2/5" 
                          : "border-muted hover-elevate"
                      )}
                      data-testid={`toggle-exchange-${exchange}`}
                    >
                      <div className="flex items-center gap-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: info.color }}
                        />
                        <span className="font-medium">{info.name}</span>
                      </div>
                      {isEnabled ? (
                        <Check className="h-4 w-4 text-chart-2" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="pairs" className="mt-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Select trading pairs to monitor
                </p>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toggleAllPairs(true)}
                    data-testid="button-select-all-pairs"
                  >
                    Select All
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => toggleAllPairs(false)}
                    data-testid="button-clear-all-pairs"
                  >
                    Clear All
                  </Button>
                  <Badge variant="outline">
                    {localSettings.enabledPairs.length}/{TRADING_PAIRS.length}
                  </Badge>
                </div>
              </div>
              
              <ScrollArea className="h-[300px] pr-4">
                <div className="grid grid-cols-3 gap-2">
                  {TRADING_PAIRS.map(pair => {
                    const isEnabled = localSettings.enabledPairs.includes(pair);
                    
                    return (
                      <button
                        key={pair}
                        onClick={() => togglePair(pair)}
                        className={cn(
                          "flex items-center justify-center p-2 rounded-md border text-sm transition-all",
                          isEnabled 
                            ? "border-chart-2/50 bg-chart-2/5 text-chart-2" 
                            : "border-muted text-muted-foreground hover-elevate"
                        )}
                        data-testid={`toggle-pair-${pair.replace("/", "-")}`}
                      >
                        {pair}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          </TabsContent>
        </Tabs>

        <div className="flex justify-end gap-2 mt-6">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-settings"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            data-testid="button-save-settings"
          >
            Save Settings
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
