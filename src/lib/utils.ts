import { CryptoCoin } from "./types";
import {
  getUserFavorites,
  addUserFavorite,
  removeUserFavorite,
  isUserFavorite,
} from "./supabase/favorites";

/**
 * Get all favorite coin IDs for a user
 * Returns empty array if user is not authenticated
 */
export async function getFavorites(userId: string | null): Promise<string[]> {
  if (!userId) return [];
  return await getUserFavorites(userId);
}

/**
 * Remove a coin from user's favorites
 * Does nothing if user is not authenticated
 */
export async function removeFavorite(userId: string | null, coinId: string): Promise<void> {
  if (!userId) return;
  await removeUserFavorite(userId, coinId);
}

/**
 * Check if a coin is in user's favorites
 * Returns false if user is not authenticated
 */
export async function isFavorite(userId: string | null, coinId: string): Promise<boolean> {
  if (!userId) return false;
  return await isUserFavorite(userId, coinId);
}

/**
 * Toggle favorite status of a coin
 * Does nothing if user is not authenticated
 */
export async function toggleFavorite(userId: string | null, coinId: string): Promise<void> {
  if (!userId) return;
  
  try {
    const isFav = await isUserFavorite(userId, coinId);
    if (isFav) {
      const result = await removeUserFavorite(userId, coinId);
      if (result.error) {
        throw new Error(result.error.message || "Failed to remove favorite");
      }
    } else {
      const result = await addUserFavorite(userId, coinId);
      if (result.error) {
        throw new Error(result.error.message || "Failed to add favorite");
      }
    }
  } catch (error) {
    console.error("Error toggling favorite:", error);
    throw error;
  }
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatLargeNumber(value: number): string {
  if (value >= 1e12) {
    return `$${(value / 1e12).toFixed(2)}T`;
  }
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`;
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`;
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`;
  }
  return formatCurrency(value);
}

export function formatPercentage(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatNumber(value: number, decimals: number = 2): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Get favorite coin objects for a user
 * Returns empty array if user is not authenticated
 * Fetches coin data from Binance API
 */
export async function getFavoritesCoins(
  userId: string | null
): Promise<CryptoCoin[]> {
  if (!userId) return [];
  
  const favoriteIds = await getUserFavorites(userId);
  if (favoriteIds.length === 0) return [];
  
  // Import here to avoid circular dependency
  const { getCoinById } = await import("./binance");
  
  // Fetch all favorite coins from Binance API
  // Use Promise.allSettled to handle individual failures gracefully
  const coinPromises = favoriteIds.map((id) => 
    getCoinById(id).catch((error) => {
      // Silently skip coins that can't be fetched (e.g., not available on Binance)
      console.warn(`Coin ${id} could not be fetched from Binance:`, error.message);
      return null;
    })
  );
  
  const results = await Promise.allSettled(coinPromises);
  const coins = results
    .map((result) => {
      if (result.status === "fulfilled" && result.value !== null) {
        return result.value;
      }
      return null;
    })
    .filter((coin): coin is CryptoCoin => coin !== null);
  
  return coins;
}
