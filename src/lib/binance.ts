import {
  BinanceTicker24hr,
  BinanceOrderBook,
  BinanceTrade,
  CryptoCoin,
} from "./types";

const BINANCE_API_BASE = "https://api.binance.com/api/v3";
const LOGO_DEV_API_KEY = "pk_WftL_Wn9Rr2QGs5pXj5uPA";

// Rate limit: 6000 REQUEST_WEIGHT per minute
// Endpoint weights:
// - GET /api/v3/ticker/24hr (single): 1 weight
// - GET /api/v3/ticker/24hr (all): 40 weight
// - GET /api/v3/depth: 1-100 weight (based on limit)
// - GET /api/v3/trades: 1 weight

// Cache duration for different endpoints (in milliseconds)
const CACHE_DURATION = {
  TICKER: 1000, // 1 second for ticker data
  ORDER_BOOK: 500, // 0.5 seconds for order book
  TRADES: 500, // 0.5 seconds for trades
  ALL_TICKERS: 2000, // 2 seconds for all tickers (heavier endpoint)
};

// Simple in-memory cache
const cache = new Map<string, { data: any; timestamp: number; duration: number }>();

// Clean up expired cache entries periodically
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

function startCacheCleanup() {
  if (cleanupInterval) return; // Already started
  
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [key, value] of cache.entries()) {
      if (now - value.timestamp >= value.duration) {
        cache.delete(key);
      }
    }
  }, 30000); // Clean every 30 seconds
}

// Start cleanup (works in both browser and Node.js)
// Use try-catch to handle edge cases where setInterval might not be available
try {
  if (typeof setInterval !== "undefined") {
    startCacheCleanup();
  }
} catch (error) {
  // Silently fail if setInterval is not available (shouldn't happen in normal environments)
  console.warn("Cache cleanup could not be started:", error);
}

/**
 * Get cached data or fetch new data
 * Returns cached data if available and not expired, otherwise fetches new data
 */
async function fetchWithCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  duration: number
): Promise<T> {
  const cached = cache.get(key);
  const now = Date.now();

  // Check if cached data exists and is still valid
  if (cached && (now - cached.timestamp) < cached.duration) {
    return cached.data as T;
  }

  // Fetch new data and cache it
  try {
    const data = await fetcher();
    cache.set(key, { data, timestamp: now, duration });
    return data;
  } catch (error) {
    // If fetch fails and we have stale cache, return it as fallback
    if (cached) {
      console.warn(`Fetch failed for ${key}, using stale cache`);
      return cached.data as T;
    }
    throw error;
  }
}

/**
 * Get 24hr ticker statistics for a symbol
 * Weight: 1 per request
 * Cached for 1 second to reduce API calls
 */
export async function getTicker24hr(symbol: string): Promise<BinanceTicker24hr> {
  const cacheKey = `ticker:${symbol.toUpperCase()}`;
  
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const response = await fetch(
          `${BINANCE_API_BASE}/ticker/24hr?symbol=${symbol.toUpperCase()}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            cache: "no-store",
          }
        );
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ msg: "Unknown error" }));
          throw new Error(error.msg || `Failed to fetch ticker for ${symbol}`);
        }
        
        return response.json();
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error("Binance API'ye bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        }
        throw error;
      }
    },
    CACHE_DURATION.TICKER
  );
}

/**
 * Get order book for a symbol
 * Weight: 1-100 (based on limit, default 20 = 1 weight)
 * Cached for 0.5 seconds to reduce API calls
 */
export async function getOrderBook(
  symbol: string,
  limit: number = 20
): Promise<BinanceOrderBook> {
  const cacheKey = `orderbook:${symbol.toUpperCase()}:${limit}`;
  
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const response = await fetch(
          `${BINANCE_API_BASE}/depth?symbol=${symbol.toUpperCase()}&limit=${limit}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            cache: "no-store",
          }
        );
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ msg: "Unknown error" }));
          throw new Error(error.msg || `Failed to fetch order book for ${symbol}`);
        }
        
        return response.json();
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error("Binance API'ye bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        }
        throw error;
      }
    },
    CACHE_DURATION.ORDER_BOOK
  );
}

/**
 * Get recent trades for a symbol
 * Weight: 1 per request
 * Cached for 0.5 seconds to reduce API calls
 */
export async function getRecentTrades(
  symbol: string,
  limit: number = 20
): Promise<BinanceTrade[]> {
  const cacheKey = `trades:${symbol.toUpperCase()}:${limit}`;
  
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const response = await fetch(
          `${BINANCE_API_BASE}/trades?symbol=${symbol.toUpperCase()}&limit=${limit}`,
          {
            method: "GET",
            headers: {
              "Accept": "application/json",
            },
            cache: "no-store",
          }
        );
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ msg: "Unknown error" }));
          throw new Error(error.msg || `Failed to fetch trades for ${symbol}`);
        }
        
        return response.json();
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error("Binance API'ye bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        }
        throw error;
      }
    },
    CACHE_DURATION.TRADES
  );
}

/**
 * Get all ticker 24hr statistics
 * Weight: 40 per request (heaviest endpoint)
 * Cached for 2 seconds to reduce API calls
 * This endpoint should be used sparingly - prefer WebSocket for real-time updates
 */
export async function getAllTickers(): Promise<BinanceTicker24hr[]> {
  const cacheKey = "allTickers";
  
  return fetchWithCache(
    cacheKey,
    async () => {
      try {
        const response = await fetch(`${BINANCE_API_BASE}/ticker/24hr`, {
          method: "GET",
          headers: {
            "Accept": "application/json",
          },
          cache: "no-store",
        });
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ msg: "Unknown error" }));
          throw new Error(error.msg || "Failed to fetch all tickers");
        }
        
        return response.json();
      } catch (error) {
        if (error instanceof TypeError && error.message === "Failed to fetch") {
          throw new Error("Binance API'ye bağlanılamadı. Lütfen internet bağlantınızı kontrol edin.");
        }
        throw error;
      }
    },
    CACHE_DURATION.ALL_TICKERS
  );
}

/**
 * Get coin image URL from img.logo.dev service
 */
function getLogoDevImageUrl(coinId: string): string {
  // Convert coin ID to lowercase for logo.dev API
  const symbol = coinId.toLowerCase();
  return `https://img.logo.dev/crypto/${symbol}?token=${LOGO_DEV_API_KEY}`;
}

/**
 * Update a CryptoCoin with data from Binance ticker
 * Used for real-time WebSocket updates
 */
export function updateCoinFromTicker(coin: CryptoCoin, ticker: BinanceTicker24hr): CryptoCoin {
  const lastPrice = parseFloat(ticker.lastPrice || "0");
  const priceChange = parseFloat(ticker.priceChange || "0");
  const priceChangePercent = parseFloat(ticker.priceChangePercent || "0");
  const highPrice = parseFloat(ticker.highPrice || "0");
  const lowPrice = parseFloat(ticker.lowPrice || "0");
  const volume = parseFloat(ticker.volume || "0");
  
  // Calculate market cap: price * volume * multiplier (rough estimate)
  // Using a more conservative multiplier to avoid overestimating
  const estimatedMarketCap = lastPrice > 0 && volume > 0 
    ? lastPrice * volume * 50 
    : coin.market_cap;
  
  return {
    ...coin,
    current_price: lastPrice > 0 ? lastPrice : coin.current_price,
    price_change_24h: priceChange,
    price_change_percentage_24h: priceChangePercent,
    high_24h: highPrice > 0 ? highPrice : coin.high_24h,
    low_24h: lowPrice > 0 ? lowPrice : coin.low_24h,
    total_volume: volume > 0 ? volume : coin.total_volume,
    market_cap: estimatedMarketCap,
    last_updated: new Date().toISOString(),
  };
}

/**
 * Convert Binance ticker to CryptoCoin format
 */
export function tickerToCryptoCoin(ticker: BinanceTicker24hr, rank: number = 0): CryptoCoin {
  // Extract base asset from symbol (e.g., "BTCUSDT" -> "BTC")
  const baseAsset = ticker.symbol.replace("USDT", "").toLowerCase();
  const lastPrice = parseFloat(ticker.lastPrice || "0");
  const volume = parseFloat(ticker.volume || "0");
  
  // Estimate market cap from volume (rough approximation)
  // This is a placeholder - real market cap requires supply data
  const estimatedMarketCap = lastPrice * volume * 100; // Rough estimate
  
  return {
    id: baseAsset,
    symbol: baseAsset,
    name: baseAsset.toUpperCase(),
    image: getLogoDevImageUrl(baseAsset), // Use img.logo.dev image URL
    current_price: lastPrice,
    market_cap: estimatedMarketCap,
    market_cap_rank: rank,
    total_volume: volume,
    high_24h: parseFloat(ticker.highPrice || "0"),
    low_24h: parseFloat(ticker.lowPrice || "0"),
    price_change_24h: parseFloat(ticker.priceChange || "0"),
    price_change_percentage_24h: parseFloat(ticker.priceChangePercent || "0"),
    circulating_supply: 0, // Not available from Binance ticker
    total_supply: undefined,
    max_supply: undefined,
    ath: parseFloat(ticker.highPrice || "0"), // Using high price as placeholder
    ath_change_percentage: 0,
    ath_date: new Date().toISOString(),
    atl: parseFloat(ticker.lowPrice || "0"), // Using low price as placeholder
    atl_change_percentage: 0,
    atl_date: new Date().toISOString(),
    last_updated: new Date().toISOString(),
  };
}

/**
 * Get all coins from Binance API
 * Returns CryptoCoin array with real-time data
 */
export async function getAllCoins(): Promise<CryptoCoin[]> {
  try {
    const tickers = await getAllTickers();
    
    // Filter only USDT pairs and convert to CryptoCoin format
    const coins = tickers
      .filter((ticker) => ticker.symbol.endsWith("USDT"))
      .map((ticker, index) => tickerToCryptoCoin(ticker, index + 1))
      .filter((coin) => coin.current_price > 0) // Filter out invalid prices
      .sort((a, b) => {
        // Sort by market cap (descending - highest first)
        return b.market_cap - a.market_cap;
      });
    
    // Reassign market cap ranks after sorting
    coins.forEach((coin, index) => {
      coin.market_cap_rank = index + 1;
    });
    
    return coins;
  } catch (error) {
    console.error("Error fetching coins from Binance:", error);
    throw error;
  }
}

/**
 * Get a single coin by ID (symbol) from Binance API
 * Returns null if coin is not found or error occurs
 */
export async function getCoinById(id: string): Promise<CryptoCoin | null> {
  try {
    const binanceSymbol = symbolToBinancePair(id);
    const ticker = await getTicker24hr(binanceSymbol);
    const coin = tickerToCryptoCoin(ticker, 0);
    
    return coin;
  } catch (error) {
    // Silently return null for coins not available on Binance
    // Error is already logged in getTicker24hr if needed
    return null;
  }
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
    // Only log if WebSocket is still open or connecting
    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      console.error("WebSocket error:", error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  };

  ws.onclose = (event) => {
    // Only log unexpected closes (not normal closure codes 1000, 1001)
    if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
      console.warn("WebSocket closed unexpectedly:", event.code, event.reason);
    }
  };
  
  return ws;
}

/**
 * Create WebSocket connection for multiple ticker streams
 * Used for real-time updates on coin list page
 */
export function createMultiTickerWebSocket(
  symbols: string[],
  callbacks: {
    onTicker?: (symbol: string, data: BinanceTicker24hr) => void;
    onError?: (error: Event) => void;
  }
): WebSocket {
  // Convert symbols to lowercase and add @ticker suffix
  const streams = symbols.map((symbol) => `${symbol.toLowerCase()}@ticker`);
  const streamNames = streams.join("/");
  const wsUrl = `wss://stream.binance.com:9443/stream?streams=${streamNames}`;
  
  const ws = new WebSocket(wsUrl);
  
  ws.onmessage = (event) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.stream && message.data && callbacks.onTicker) {
        const streamName = message.stream;
        const data = message.data;
        
        // Extract symbol from stream name (e.g., "btcusdt@ticker" -> "BTCUSDT")
        const symbol = streamName.split("@")[0].toUpperCase();
        
        // Convert WebSocket ticker format to BinanceTicker24hr format
        const tickerData: BinanceTicker24hr = {
          symbol: data.s || symbol,
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
        
        callbacks.onTicker(symbol, tickerData);
      }
    } catch (error) {
      console.error("Error parsing WebSocket message:", error);
    }
  };
  
  ws.onerror = (error) => {
    // Only log if WebSocket is still open or connecting
    if (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN) {
      console.error("WebSocket error:", error);
      if (callbacks.onError) {
        callbacks.onError(error);
      }
    }
  };

  ws.onclose = (event) => {
    // Only log unexpected closes (not normal closure codes 1000, 1001)
    if (event.code !== 1000 && event.code !== 1001 && event.code !== 1005) {
      console.warn("WebSocket closed unexpectedly:", event.code, event.reason);
    }
  };
  
  return ws;
}

/**
 * Convert coin symbol to Binance USDT pair format
 * e.g., "btc" -> "BTCUSDT", "eth" -> "ETHUSDT"
 */
export function symbolToBinancePair(symbol: string): string {
  return `${symbol.toUpperCase()}USDT`;
}
