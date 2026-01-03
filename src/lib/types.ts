export interface CryptoCoin {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  fully_diluted_valuation?: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  market_cap_change_24h?: number;
  market_cap_change_percentage_24h?: number;
  circulating_supply: number;
  total_supply?: number;
  max_supply?: number;
  ath: number;
  ath_change_percentage: number;
  ath_date: string;
  atl: number;
  atl_change_percentage: number;
  atl_date: string;
  last_updated: string;
}

export type SortField = "market_cap_rank" | "current_price" | "price_change_percentage_24h" | "market_cap";
export type SortOrder = "asc" | "desc";

export interface FilterOptions {
  minPrice?: number;
  maxPrice?: number;
  minMarketCap?: number;
  maxMarketCap?: number;
}

export interface PriceHistory {
  date: string;
  price: number;
}

export interface MovementIndex {
  adx: number;
  pdi: number;
  mdi: number;
}

export interface EMA {
  value: number;
}

export interface Price {
  value: number;
}

export interface RSI {
  value: number;
}

export interface Candle {
  timestampHuman: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface AnalysisData {
  movementIndex: MovementIndex;
  ema: EMA;
  price: Price;
  rsi: RSI;
  candle: Candle;
}

export type ColorMode = "light" | "dark" | "auto";

export interface UserSettings {
  id?: string;
  user_id: string;
  color_mode: ColorMode;
  notifications_enabled: boolean;
  email_notifications: boolean;
  price_alerts: boolean;
  newsletter: boolean;
  two_factor_auth: boolean;
  updated_at?: string;
}

// Binance API Types
export interface BinanceTicker24hr {
  symbol: string;
  priceChange: string;
  priceChangePercent: string;
  weightedAvgPrice: string;
  prevClosePrice: string;
  lastPrice: string;
  lastQty: string;
  bidPrice: string;
  bidQty: string;
  askPrice: string;
  askQty: string;
  openPrice: string;
  highPrice: string;
  lowPrice: string;
  volume: string;
  quoteVolume: string;
  openTime: number;
  closeTime: number;
  firstId: number;
  lastId: number;
  count: number;
}

// Binance orderbook entries come as [price, qty] tuples
export type BinanceOrderBookEntry = [string, string];

export interface BinanceOrderBook {
  lastUpdateId: number;
  bids: BinanceOrderBookEntry[];
  asks: BinanceOrderBookEntry[];
}

export interface BinanceTrade {
  id: number;
  price: string;
  qty: string;
  quoteQty: string;
  time: number;
  isBuyerMaker: boolean;
  isBestMatch: boolean;
}
