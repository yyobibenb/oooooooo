import { randomUUID } from "crypto";
import type { ArbitrageOpportunity, Signal } from "@shared/schema";
import { EXCHANGE_INFO } from "@shared/schema";

export class TelegramService {
  private botToken: string | null = null;
  private chatId: string | null = null;
  private enabled: boolean = true;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || null;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;
    
    if (this.botToken && this.chatId) {
      console.log("[Telegram] Bot configured successfully");
    } else {
      console.log("[Telegram] Bot not configured - missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID");
    }
  }

  isConfigured(): boolean {
    return !!(this.botToken && this.chatId);
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async sendOpportunity(opportunity: ArbitrageOpportunity): Promise<Signal | null> {
    if (!this.enabled || !this.isConfigured()) {
      return null;
    }

    const buyExchange = EXCHANGE_INFO[opportunity.buyExchange];
    const sellExchange = EXCHANGE_INFO[opportunity.sellExchange];

    const message = this.formatOpportunityMessage(opportunity, buyExchange, sellExchange);

    try {
      const result = await this.sendMessage(message);
      
      const signal: Signal = {
        id: randomUUID(),
        opportunity,
        sentAt: Date.now(),
        delivered: result.success,
        telegramMessageId: result.messageId
      };

      return signal;
    } catch (error) {
      console.error("[Telegram] Failed to send message:", error);
      return null;
    }
  }

  async sendTestMessage(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConfigured()) {
      return { success: false, error: "Telegram bot not configured" };
    }

    const message = `🔔 *CryptoArb Test Message*

✅ Telegram integration is working!

Bot is ready to send arbitrage signals.

_Sent at: ${new Date().toISOString()}_`;

    try {
      const result = await this.sendMessage(message);
      return { success: result.success };
    } catch (error) {
      return { success: false, error: String(error) };
    }
  }

  private formatOpportunityMessage(
    opportunity: ArbitrageOpportunity,
    buyExchange: { name: string },
    sellExchange: { name: string }
  ): string {
    const profitEmoji = opportunity.profitPercent >= 2 ? "🔥" : opportunity.profitPercent >= 1.5 ? "⚡" : "💰";
    
    // Ultra high precision formatting for prices (12 decimals for small coins)
    const formatPrice = (price: number): string => {
      if (price >= 1000) return price.toFixed(8);
      if (price >= 1) return price.toFixed(10);
      return price.toFixed(12);
    };
    
    return `${profitEmoji} *Arbitrage Alert!*

📊 *Pair:* \`${opportunity.pair}\`
📈 *Profit:* \`+${opportunity.profitPercent.toFixed(10)}%\` (~$${opportunity.estimatedProfit.toFixed(8)})

🟢 *Buy:* ${buyExchange.name}
   └ Price: \`$${formatPrice(opportunity.buyPrice)}\`
   └ Fee: \`$${opportunity.buyFee.toFixed(8)}\`

🔴 *Sell:* ${sellExchange.name}
   └ Price: \`$${formatPrice(opportunity.sellPrice)}\`
   └ Fee: \`$${opportunity.sellFee.toFixed(8)}\`

📉 *Spread:* \`${opportunity.spreadPercent.toFixed(10)}%\`
💵 *Fees:* \`${((opportunity.buyFee + opportunity.sellFee) / 10).toFixed(8)}%\`

⏰ _${new Date(opportunity.timestamp).toLocaleTimeString()}_

━━━━━━━━━━━━━━━━━━━━
⚠️ *DYOR* - Verify prices before trading!`;
  }

  private async sendMessage(text: string): Promise<{ success: boolean; messageId?: string }> {
    if (!this.botToken || !this.chatId) {
      return { success: false };
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${this.botToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            chat_id: this.chatId,
            text,
            parse_mode: "Markdown",
            disable_web_page_preview: true
          })
        }
      );

      const data = await response.json() as { ok: boolean; result?: { message_id: number } };
      
      if (data.ok) {
        return { 
          success: true, 
          messageId: data.result?.message_id?.toString() 
        };
      } else {
        console.error("[Telegram] API error:", data);
        return { success: false };
      }
    } catch (error) {
      console.error("[Telegram] Request failed:", error);
      return { success: false };
    }
  }
}
