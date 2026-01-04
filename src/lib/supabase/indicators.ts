import { createClient } from "./client";

export interface SwingIndicators {
  id: string;
  coin_id: string;
  coin_symbol: string;
  ma: number | null;
  atr: number | null;
  fib_value: number | null;
  fib_trend: string | null;
  fib_start_price: number | null;
  fib_end_price: number | null;
  rsi: number | null;
  adx: number | null;
  updated_at: string;
  created_at: string;
}

export interface ScalpIndicators {
  id: string;
  coin_id: string;
  coin_symbol: string;
  atr: number | null;
  vwap: number | null;
  bbands_upper: number | null;
  bbands_middle: number | null;
  bbands_lower: number | null;
  pivot_r3: number | null;
  pivot_r2: number | null;
  pivot_r1: number | null;
  pivot_p: number | null;
  pivot_s1: number | null;
  pivot_s2: number | null;
  pivot_s3: number | null;
  rsi: number | null;
  updated_at: string;
  created_at: string;
}

/**
 * Cache'in yaşını kontrol et (1 dakikadan eski mi?)
 */
export function isCacheFresh(updatedAt: string): boolean {
  const updated = new Date(updatedAt).getTime();
  const now = Date.now();
  const oneMinute = 60 * 1000; // 1 dakika milisaniye cinsinden
  return (now - updated) < oneMinute;
}

/**
 * Cache'den swing göstergelerini getir
 */
export async function getSwingIndicatorsFromCache(
  coinId: string
): Promise<SwingIndicators | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("swing_indicators")
      .select("*")
      .eq("coin_id", coinId)
      .single();

    if (error) {
      console.error("Error fetching swing indicators from cache:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getSwingIndicatorsFromCache:", error);
    return null;
  }
}

/**
 * Cache'den scalp göstergelerini getir
 */
export async function getScalpIndicatorsFromCache(
  coinId: string
): Promise<ScalpIndicators | null> {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("scalp_indicators")
      .select("*")
      .eq("coin_id", coinId)
      .single();

    if (error) {
      console.error("Error fetching scalp indicators from cache:", error);
      return null;
    }

    return data;
  } catch (error) {
    console.error("Error in getScalpIndicatorsFromCache:", error);
    return null;
  }
}

/**
 * Cache'den göstergeleri getir (strategy'ye göre)
 */
export async function getIndicatorsFromCache(
  coinId: string,
  strategy: "swing" | "scalp"
): Promise<{ data: SwingIndicators | ScalpIndicators | null; is_fresh: boolean }> {
  if (strategy === "swing") {
    const data = await getSwingIndicatorsFromCache(coinId);
    if (!data) {
      return { data: null, is_fresh: false };
    }
    return { data, is_fresh: isCacheFresh(data.updated_at) };
  } else {
    const data = await getScalpIndicatorsFromCache(coinId);
    if (!data) {
      return { data: null, is_fresh: false };
    }
    return { data, is_fresh: isCacheFresh(data.updated_at) };
  }
}
