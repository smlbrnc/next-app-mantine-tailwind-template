"use client";

import { HeaderMenu } from "@/components/header-menu";
import { Footer } from "@/components/footer";
import { AppShell, AppShellMain, Container, Title, Stack, Group, Pagination, Center } from "@mantine/core";
import { SearchBar } from "@/components/search-bar";
import { FilterPanel } from "@/components/filter-panel";
import { CryptoTable } from "@/components/crypto-table";
import { SortField, SortOrder, FilterOptions, CryptoCoin } from "@/lib/types";
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { getAllCoins, createMultiTickerWebSocket, symbolToBinancePair, updateCoinFromTicker } from "@/lib/binance";
import { BinanceTicker24hr } from "@/lib/types";
import { usePagination } from "@mantine/hooks";

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("market_cap");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [filters, setFilters] = useState<FilterOptions>({});
  const [coins, setCoins] = useState<CryptoCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial load from Binance API
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    try {
      const allCoins = await getAllCoins();
      setCoins(allCoins);
    } catch (error) {
      console.error("Error loading initial data:", error);
      setCoins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    // Initial load
    loadInitialData();

    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Wait for coins to load before setting up WebSocket
    if (coins.length > 0) {
      // Get all symbols for WebSocket (limit to first 100 to avoid URL length issues)
      const symbols = coins
        .slice(0, 100)
        .map((coin) => symbolToBinancePair(coin.symbol));
      
      // Create WebSocket connection for all tickers
      const ws = createMultiTickerWebSocket(symbols, {
        onTicker: (symbol, tickerData) => {
          // Find corresponding coin and update
          setCoins((prevCoins) => {
            return prevCoins.map((coin) => {
              const coinBinanceSymbol = symbolToBinancePair(coin.symbol);
              if (coinBinanceSymbol === symbol) {
                return updateCoinFromTicker(coin, tickerData);
              }
              return coin;
            });
          });
        },
        onError: (error) => {
          console.error("WebSocket error:", error);
        },
      });

      wsRef.current = ws;

      return () => {
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
      };
    }
  }, [loadInitialData, coins.length]);

  const filteredAndSortedCoins = useMemo(() => {
    let result = [...coins];

    // Arama filtresi
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (coin) =>
          coin.name.toLowerCase().includes(query) ||
          coin.symbol.toLowerCase().includes(query)
      );
    }

    // Fiyat filtresi
    if (filters.minPrice !== undefined) {
      result = result.filter((coin) => coin.current_price >= filters.minPrice!);
    }
    if (filters.maxPrice !== undefined) {
      result = result.filter((coin) => coin.current_price <= filters.maxPrice!);
    }

    // Market cap filtresi
    if (filters.minMarketCap !== undefined) {
      result = result.filter((coin) => coin.market_cap >= filters.minMarketCap!);
    }
    if (filters.maxMarketCap !== undefined) {
      result = result.filter((coin) => coin.market_cap <= filters.maxMarketCap!);
    }

    // Sıralama
    result.sort((a, b) => {
      let aValue: number;
      let bValue: number;

      switch (sortField) {
        case "current_price":
          aValue = a.current_price;
          bValue = b.current_price;
          break;
        case "price_change_percentage_24h":
          aValue = a.price_change_percentage_24h;
          bValue = b.price_change_percentage_24h;
          break;
        case "market_cap":
          aValue = a.market_cap;
          bValue = b.market_cap;
          break;
        case "market_cap_rank":
        default:
          aValue = a.market_cap_rank;
          bValue = b.market_cap_rank;
          break;
      }

      if (sortOrder === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });

    return result;
  }, [searchQuery, filters, sortField, sortOrder, coins]);

  // Pagination - her sayfada 30 coin
  const ITEMS_PER_PAGE = 30;
  const totalPages = Math.ceil(filteredAndSortedCoins.length / ITEMS_PER_PAGE);
  
  const pagination = usePagination({ 
    total: totalPages > 0 ? totalPages : 1, 
    initialPage: 1,
  });

  // Filtre veya sıralama değiştiğinde ilk sayfaya dön
  useEffect(() => {
    if (pagination.active !== 1) {
      pagination.setPage(1);
    }
  }, [searchQuery, filters, sortField, sortOrder]);

  // Mevcut sayfadaki coin'leri al
  const paginatedCoins = useMemo(() => {
    const startIndex = (pagination.active - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    return filteredAndSortedCoins.slice(startIndex, endIndex);
  }, [filteredAndSortedCoins, pagination.active]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleResetFilters = () => {
    setFilters({});
    setSearchQuery("");
  };

  return (
    <AppShell header={{ height: 110 }} padding={0}>
      <HeaderMenu />
      <AppShellMain className="pt-4">
        <Container size="xl">
          <Stack gap="md">
            <Title order={1}>Kripto Para Piyasaları</Title>

            <Stack gap="md">
              <Group justify="space-between" align="flex-end" wrap="wrap">
                <SearchBar
                  value={searchQuery}
                  onChange={setSearchQuery}
                  placeholder="Coin ara..."
                  label="Ara"
                />
                <FilterPanel
                  filters={filters}
                  onFiltersChange={setFilters}
                  onReset={handleResetFilters}
                />
              </Group>

              <CryptoTable
                coins={paginatedCoins}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
              />

              {totalPages > 1 && (
                <Center mt="xl">
                  <Pagination
                    total={totalPages}
                    value={pagination.active}
                    onChange={pagination.setPage}
                    size="md"
                    radius="md"
                  />
                </Center>
              )}
            </Stack>
          </Stack>
        </Container>
        <Footer />
      </AppShellMain>
    </AppShell>
  );
}
