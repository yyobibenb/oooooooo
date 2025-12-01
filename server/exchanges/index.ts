import { BaseExchange } from "./base";
import { BybitExchange } from "./bybit";
import { OKXExchange } from "./okx";
import { MEXCExchange } from "./mexc";
import { BitgetExchange } from "./bitget";
import { GateioExchange } from "./gateio";
import { KuCoinExchange } from "./kucoin";
import { CoinExExchange } from "./coinex";
import { BingXExchange } from "./bingx";
import type { ExchangeId } from "@shared/schema";

export function createExchange(id: ExchangeId): BaseExchange {
  switch (id) {
    case "bybit":
      return new BybitExchange();
    case "okx":
      return new OKXExchange();
    case "mexc":
      return new MEXCExchange();
    case "bitget":
      return new BitgetExchange();
    case "gateio":
      return new GateioExchange();
    case "kucoin":
      return new KuCoinExchange();
    case "coinex":
      return new CoinExExchange();
    case "bingx":
      return new BingXExchange();
    default:
      throw new Error(`Unknown exchange: ${id}`);
  }
}

export { BaseExchange };
