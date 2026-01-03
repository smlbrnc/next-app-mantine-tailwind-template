import {
  BinanceTicker24hr,
  BinanceOrderBook,
  BinanceTrade,
} from "./types";

const BINANCE_API_BASE = "https://api.binance.com/api/v3";

/**
 * Get 24hr ticker statistics for a symbol
 */
export async function getTicker24hr(symbol: string): Promise<BinanceTicker24hr> {
  const response = await fetch(`${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Unknown error" }));
    throw new Error(error.msg || `Failed to fetch ticker for ${symbol}`);
  }
  
  return response.json();
}

/**
 * Get order book for a symbol
 */
export async function getOrderBook(
  symbol: string,
  limit: number = 20
): Promise<BinanceOrderBook> {
  const response = await fetch(
    `${BINANCE_API_BASE}/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Unknown error" }));
    throw new Error(error.msg || `Failed to fetch order book for ${symbol}`);
  }
  
  return response.json();
}

/**
 * Get recent trades for a symbol
 */
export async function getRecentTrades(
  symbol: string,
  limit: number = 20
): Promise<BinanceTrade[]> {
  const response = await fetch(
    `${BINANCE_API_BASE}/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`
  );
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Unknown error" }));
    throw new Error(error.msg || `Failed to fetch trades for ${symbol}`);
  }
  
  return response.json();
}

/**
 * Get all ticker 24hr statistics
 */
export async function getAllTickers(): Promise<BinanceTicker24hr[]> {
  const response = await fetch(`${BINANCE_API_BASE}/ticker/24hr`);
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ msg: "Unknown error" }));
    throw new Error(error.msg || "Failed to fetch all tickers");
  }
  
  return response.json();
}

/**
 * Create WebSocket connection for real-time market data
 * Uses Binance WebSocket Stream API
 */
export function createBinanceWebSocket(
  symbol: string,
  callbacks: {
    onTicker?: (data: any) => void;
    onDepth?: (data: any) => void;
    onTrade?: (data: any) => void;
    onError?: (error: Event) => void;
  }
): WebSocket {
  const symbolLower = symbol.toLowerCase();
  
  // Binance WebSocket streams - using combined stream endpoint
  const streams = [
    `${symbolLower}@ticker`,
    `${symbolLower}@depth20@100ms`,
    `${symbolLower}@trade`,
  ];
  
  const streamNames = streams.join("/");
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.stream && message.data) {
        const streamName = message.stream;
        const data = message.data;
        
        // Ticker stream: <symbol>@ticker
        if (streamName.includes("@ticker") && callbacks.onTicker) {
          // Binance WebSocket ticker format to REST API format conversion
          const tickerData: BinanceTicker24hr = {
            symbol: data.s,
            priceChange: data.P,
            priceChangePercent: data.p,
            weightedAvgPrice: data.w,
            prevClosePrice: data.x,
            lastPrice: data.c,
            lastQty: data.Q,
            bidPrice: data.b,
            bidQty: data.B,
            askPrice: data.a,
            askQty: data.A,
            openPrice: data.o,
            highPrice: data.h,
            lowPrice: data.l,
            volume: data.v,
            quoteVolume: data.q,
            openTime: data.O,
            closeTime: data.C,
            firstId: data.F,
            lastId: data.L,
            count: data.n,
          };
          callbacks.onTicker(tickerData);
        } 
        // Depth stream: <symbol>@depth20@100ms
        else if (streamName.includes("@depth") && callbacks.onDepth) {
          // WebSocket depth update - incremental updates
          // data.b = bids array, data.a = asks array
          const orderBook: BinanceOrderBook = {
            lastUpdateId: data.u || data.lastUpdateId || 0,
            bids: data.b || [],
            asks: data.a || [],
          };
          callbacks.onDepth(orderBook);
        } 
        // Trade stream: <symbol>@trade
        else if (streamName.includes("@trade") && callbacks.onTrade) {
          // Convert WebSocket trade format to BinanceTrade format
          const tradeData: BinanceTrade = {
            id: data.t,
            price: data.p,
            qty: data.q,
            quoteQty: (parseFloat(data.p) * parseFloat(data.q)).toString(),
            time: data.T,
            isBuyerMaker: data.m,
            isBestMatch: data.M,
          };
          callbacks.onTrade(tradeData);
        }
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
  
  ws.onerror = (error) => {
    console.error("WebSocket error:", error);
    if (callbacks.onError) {
      callbacks.onError(error);
    }
  };
  
  return ws;
}
