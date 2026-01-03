"use client";

import {
  Container,
  Title,
  Text,
  Group,
  Stack,
  Paper,
  Badge,
  Button,
  Grid,
  Table,
  Avatar,
} from "@mantine/core";
import { IconStar, IconStarFilled } from "@tabler/icons-react";
import { CryptoCoin, PriceHistory } from "@/lib/types";
import {
  formatCurrency,
  formatLargeNumber,
  formatPercentage,
  isFavorite,
  toggleFavorite,
} from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { getTicker24hr, createBinanceWebSocket, symbolToBinancePair, updateCoinFromTicker } from "@/lib/binance";
import { BinanceTicker24hr } from "@/lib/types";

interface CoinDetailProps {
  coin: CryptoCoin;
}

export function CoinDetail({ coin }: CoinDetailProps) {
  const { user } = useAuth();
  const [isFav, setIsFav] = useState(false);
  const [loading, setLoading] = useState(false);
  const [coinData, setCoinData] = useState<CryptoCoin>(coin);
  const [loadingData, setLoadingData] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Initial load from Binance API
  const loadInitialData = useCallback(async () => {
    setLoadingData(true);
    try {
      const binanceSymbol = symbolToBinancePair(coin.symbol);
      const ticker = await getTicker24hr(binanceSymbol);
      const updatedCoin = updateCoinFromTicker(coin, ticker);
      setCoinData(updatedCoin);
    } catch (error) {
      console.error("Error loading coin data:", error);
      // Fallback to original coin data on error
      setCoinData(coin);
    } finally {
      setLoadingData(false);
    }
  }, [coin, updateCoinFromTicker]);

  // Setup WebSocket for real-time updates
  useEffect(() => {
    let isMounted = true;
    let ws: WebSocket | null = null;

    // Initial load
    loadInitialData();

    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Delay WebSocket connection to avoid race conditions
    const timeoutId = setTimeout(() => {
      if (!isMounted) return;

      const binanceSymbol = symbolToBinancePair(coin.symbol);

      // Create WebSocket connection
      ws = createBinanceWebSocket(binanceSymbol, {
        onTicker: (tickerData) => {
          if (isMounted) {
            setCoinData((prevCoin) => updateCoinFromTicker(prevCoin, tickerData));
          }
        },
        onError: (error) => {
          // Only log if component is still mounted
          if (isMounted) {
            console.error("WebSocket error:", error);
          }
        },
      });

      wsRef.current = ws;
    }, 100);

    return () => {
      isMounted = false;
      clearTimeout(timeoutId);
      
      if (wsRef.current) {
        try {
          wsRef.current.close();
        } catch (error) {
          // Ignore close errors
        }
        wsRef.current = null;
      }
    };
  }, [coin.symbol, loadInitialData]);

  useEffect(() => {
    if (user?.id) {
      loadFavoriteStatus();
    } else {
      setIsFav(false);
    }
  }, [user?.id, coinData.id]);

  const loadFavoriteStatus = async () => {
    if (!user?.id) return;
    const favorite = await isFavorite(user.id, coin.id);
    setIsFav(favorite);
  };

  const handleToggleFavorite = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      await toggleFavorite(user.id, coin.id);
      setIsFav((prev) => !prev);
    } catch (error) {
      console.error("Error toggling favorite:", error);
    } finally {
      setLoading(false);
    }
  };

  const isPositive = coinData.price_change_percentage_24h >= 0;

  // Mock price history data
  const priceHistory: PriceHistory[] = [
    { date: "2024-01-01", price: coinData.current_price * 0.95 },
    { date: "2024-01-02", price: coinData.current_price * 0.97 },
    { date: "2024-01-03", price: coinData.current_price * 0.99 },
    { date: "2024-01-04", price: coinData.current_price },
  ];

  return (
    <Container size="xl" py="xl">
      <Stack gap="xl">
        {/* Header */}
        <Group justify="space-between" align="flex-start">
          <Group gap="md">
            <Avatar src={coinData.image} alt={coinData.name} size="xl" />
            <Stack gap={4}>
              <Group gap="sm">
                <Title order={1}>{coinData.name}</Title>
                <Badge size="lg" variant="light" tt="uppercase">
                  {coinData.symbol}
                </Badge>
                <Badge
                  size="lg"
                  color={isPositive ? "green" : "red"}
                  variant="light"
                >
                  {formatPercentage(coinData.price_change_percentage_24h)}
                </Badge>
              </Group>
              <Text c="dimmed" size="sm">
                Market Cap Rank: #{coinData.market_cap_rank}
              </Text>
            </Stack>
          </Group>
          {user?.id ? (
            <Button
              leftSection={isFav ? <IconStarFilled size={18} /> : <IconStar size={18} />}
              variant={isFav ? "filled" : "outline"}
              color={isFav ? "yellow" : "gray"}
              onClick={handleToggleFavorite}
              loading={loading}
              disabled={loading}
            >
              {isFav ? "Favorilerden Çıkar" : "Favorilere Ekle"}
            </Button>
          ) : null}
        </Group>

        {/* Price Info */}
        <Paper p="lg" withBorder>
          <Stack gap="md">
            <Text size="xl" fw={700}>
              {formatCurrency(coinData.current_price)}
            </Text>
            <Group gap="lg">
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  24s Yüksek
                </Text>
                <Text fw={500}>{formatCurrency(coinData.high_24h)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  24s Düşük
                </Text>
                <Text fw={500}>{formatCurrency(coinData.low_24h)}</Text>
              </Stack>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Değişim (24s)
                </Text>
                <Text fw={500} c={isPositive ? "green" : "red"}>
                  {formatCurrency(coinData.price_change_24h)} (
                  {formatPercentage(coinData.price_change_percentage_24h)})
                </Text>
              </Stack>
            </Group>
          </Stack>
        </Paper>

        {/* Stats Grid */}
        <Grid>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Market Cap
                </Text>
                <Text fw={600}>{formatLargeNumber(coinData.market_cap)}</Text>
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Toplam Hacim
                </Text>
                <Text fw={600}>{formatLargeNumber(coinData.total_volume)}</Text>
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Dolaşımdaki Arz
                </Text>
                <Text fw={600}>
                  {coinData.circulating_supply.toLocaleString()} {coinData.symbol.toUpperCase()}
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Toplam Arz
                </Text>
                <Text fw={600}>
                  {coinData.total_supply
                    ? `${coinData.total_supply.toLocaleString()} ${coinData.symbol.toUpperCase()}`
                    : "N/A"}
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* All Time High/Low */}
        <Grid>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Tüm Zamanların En Yükseği (ATH)
                </Text>
                <Text fw={600} size="lg">
                  {formatCurrency(coinData.ath)}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatPercentage(coinData.ath_change_percentage)} (
                  {new Date(coinData.ath_date).toLocaleDateString("tr-TR")})
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
          <Grid.Col span={{ base: 12, md: 6 }}>
            <Paper p="md" withBorder>
              <Stack gap={4}>
                <Text size="sm" c="dimmed">
                  Tüm Zamanların En Düşüğü (ATL)
                </Text>
                <Text fw={600} size="lg">
                  {formatCurrency(coinData.atl)}
                </Text>
                <Text size="xs" c="dimmed">
                  {formatPercentage(coinData.atl_change_percentage)} (
                  {new Date(coinData.atl_date).toLocaleDateString("tr-TR")})
                </Text>
              </Stack>
            </Paper>
          </Grid.Col>
        </Grid>

        {/* Price History Table */}
        <Paper p="lg" withBorder>
          <Title order={3} mb="md">
            Fiyat Geçmişi
          </Title>
          <Table>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Tarih</Table.Th>
                <Table.Th>Fiyat</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {priceHistory.map((entry, index) => (
                <Table.Tr key={index}>
                  <Table.Td>{new Date(entry.date).toLocaleDateString("tr-TR")}</Table.Td>
                  <Table.Td>{formatCurrency(entry.price)}</Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      </Stack>
    </Container>
  );
}
