"use client";

import { HeaderMenu } from "@/components/header-menu";
import { Footer } from "@/components/footer";
import {
  AppShell,
  AppShellMain,
  Container,
  Title,
  Stack,
  Text,
  Paper,
  Group,
  Badge,
  Avatar,
  Grid,
  Button,
  Loader,
  Alert,
  Divider,
  Skeleton,
} from "@mantine/core";
import { IconArrowUpRight, IconArrowDownRight, IconAlertCircle } from "@tabler/icons-react";
import { getAnalysisData } from "@/lib/analysis-data";
import { getFavoritesCoins, formatCurrency, formatPercentage, formatLargeNumber, formatNumber } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef, useCallback } from "react";
import { CryptoCoin, BinanceTicker24hr } from "@/lib/types";
import { createMultiTickerWebSocket, symbolToBinancePair, updateCoinFromTicker } from "@/lib/binance";

export default function AnalizPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<CryptoCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzingCoinId, setAnalyzingCoinId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [expandedCoins, setExpandedCoins] = useState<Set<string>>(new Set());
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);

  const loadingTexts = [
    "Yapay zeka analiz yapıyor...",
    "Teknik göstergeler inceleniyor...",
    "Trend analizi yapılıyor...",
    "Sonuçlar hazırlanıyor...",
  ];

  useEffect(() => {
    if (user?.id) {
      loadFavorites();
    } else {
      setFavorites([]);
      setLoading(false);
    }
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const favoriteCoins = await getFavoritesCoins(user.id);
      setFavorites(favoriteCoins);
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  // Setup WebSocket for real-time updates
  useEffect(() => {
    // Close existing WebSocket
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Wait for favorites to load before setting up WebSocket
    if (favorites.length > 0) {
      // Get all symbols for WebSocket
      const symbols = favorites
        .map((coin) => symbolToBinancePair(coin.symbol))
        .filter((symbol) => symbol); // Filter out invalid symbols
      
      if (symbols.length > 0) {
        // Create WebSocket connection for all tickers
        const ws = createMultiTickerWebSocket(symbols, {
          onTicker: (symbol, tickerData) => {
            // Find corresponding coin and update
            setFavorites((prevFavorites) => {
              return prevFavorites.map((coin) => {
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
    }
  }, [favorites.length]);

  // Rotate loading texts when analyzing
  useEffect(() => {
    if (analyzingCoinId) {
      const interval = setInterval(() => {
        setLoadingTextIndex((prev) => (prev + 1) % 4);
      }, 2000); // Change text every 2 seconds

      return () => clearInterval(interval);
    } else {
      setLoadingTextIndex(0);
    }
  }, [analyzingCoinId]);

  const handleAnalyze = async (coin: CryptoCoin, analysis: any) => {
    if (!analysis) return;

    setAnalyzingCoinId(coin.id);
    setAnalysisErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[coin.id];
      return newErrors;
    });

    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          coinName: coin.name,
          symbol: coin.symbol,
          price: analysis.price?.value || coin.current_price,
          volume: analysis.candle.volume,
          rsi: analysis.rsi.value,
          ema: analysis.ema.value,
          adx: analysis.movementIndex.adx,
          pdi: analysis.movementIndex.pdi,
          mdi: analysis.movementIndex.mdi,
          candle: {
            open: analysis.candle.open,
            close: analysis.candle.close,
            high: analysis.candle.high,
            low: analysis.candle.low,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Analiz oluşturulurken bir hata oluştu");
      }

      const data = await response.json();
      setAnalysisResults((prev) => ({
        ...prev,
        [coin.id]: data.analysis,
      }));
      // Analiz sonuçları varsayılan olarak açık olsun
      setExpandedCoins((prev) => new Set(prev).add(coin.id));
    } catch (error) {
      console.error("Analysis error:", error);
      setAnalysisErrors((prev) => ({
        ...prev,
        [coin.id]: error instanceof Error ? error.message : "Analiz oluşturulurken bir hata oluştu",
      }));
    } finally {
      setAnalyzingCoinId(null);
    }
  };

  const toggleExpanded = (coinId: string) => {
    setExpandedCoins((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(coinId)) {
        newSet.delete(coinId);
      } else {
        newSet.add(coinId);
      }
      return newSet;
    });
  };

  if (loading) {
    return (
      <AppShell header={{ height: 110 }} padding={0}>
        <HeaderMenu />
        <AppShellMain className="pt-4">
          <Container size="xl">
            <Stack gap="xl" align="center" py="xl">
              <Text>Yükleniyor...</Text>
            </Stack>
            <Footer />
          </Container>
        </AppShellMain>
      </AppShell>
    );
  }

  if (!user?.id) {
    return (
      <AppShell header={{ height: 110 }} padding={0}>
        <HeaderMenu />
        <AppShellMain className="pt-4">
          <Container size="xl">
            <Stack gap="xl" align="center" py="xl">
              <Title order={2}>Giriş Yapın</Title>
              <Text c="dimmed" ta="center">
                Analiz sayfasını görmek için giriş yapmanız gerekiyor.
              </Text>
            </Stack>
            <Footer />
          </Container>
        </AppShellMain>
      </AppShell>
    );
  }

  if (favorites.length === 0) {
    return (
      <AppShell header={{ height: 110 }} padding={0}>
        <HeaderMenu />
        <AppShellMain className="pt-4">
          <Container size="xl">
            <Stack gap="xl" align="center" py="xl">
              <Title order={2}>Favori Coin Yok</Title>
              <Text c="dimmed" ta="center">
                Analiz yapmak için favorilerinize coin ekleyin.
              </Text>
            </Stack>
            <Footer />
          </Container>
        </AppShellMain>
      </AppShell>
    );
  }

  return (
    <AppShell header={{ height: 110 }} padding={0}>
        <HeaderMenu />
        <AppShellMain className="pt-4">
          <Container size="xl">
            <Stack gap="xl">
              <Title order={1}>Analiz</Title>

            <Stack gap="md">
              {favorites.map((coin) => {
                const isPositive = coin.price_change_percentage_24h >= 0;
                const changeColor = isPositive ? "green" : "red";
                const analysis = getAnalysisData(coin.id, coin.current_price);

                return (
                  <Paper
                    key={coin.id}
                    p="md"
                    withBorder
                    radius="md"
                  >
                    <Grid gutter="md">
                      {/* Grid 1: Coin Info */}
                      <Grid.Col span={{ base: 12, sm: 3 }}>
                        <Group gap="md" wrap="nowrap">
                          <Avatar src={coin.image} alt={coin.name} size={50} />
                          <Stack gap={4}>
                            <Group gap="sm" align="center">
                              <Text fw={700} size="md">
                                {coin.name}
                              </Text>
                              <Badge variant="light" tt="uppercase" size="sm">
                                {coin.symbol}
                              </Badge>
                              <Badge
                                color={changeColor}
                                variant="light"
                                size="sm"
                                leftSection={
                                  isPositive ? (
                                    <IconArrowUpRight size={12} />
                                  ) : (
                                    <IconArrowDownRight size={12} />
                                  )
                                }
                              >
                                {formatPercentage(coin.price_change_percentage_24h)}
                              </Badge>
                            </Group>
                            <Text fw={700} size="xl">
                              {analysis?.price ? formatCurrency(analysis.price.value) : formatCurrency(coin.current_price)}
                            </Text>
                            <Group gap={4} align="center">
                              <Text size="xs" c="dimmed" fw={500}>
                                Hacim:
                              </Text>
                              <Text fw={600} size="sm">
                                {formatLargeNumber(coin.total_volume)}
                              </Text>
                            </Group>
                          </Stack>
                        </Group>
                      </Grid.Col>

                      {/* Grid 2: Analysis Metrics Container */}
                      <Grid.Col span={{ base: 12, sm: 7 }}>
                        {analysis && (
                          <Paper p="md" withBorder radius="md" style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
                            <Group gap="xl" justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                              {/* RSI */}
                              <Stack gap={2} align="center" style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" fw={500}>
                                  RSI
                                </Text>
                                <Text fw={600} size="sm">
                                  {formatNumber(analysis.rsi.value, 2)}
                                </Text>
                              </Stack>

                              {/* EMA */}
                              <Stack gap={2} align="center" style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" fw={500}>
                                  EMA
                                </Text>
                                <Text fw={600} size="sm">
                                  {formatCurrency(analysis.ema.value)}
                                </Text>
                              </Stack>

                              {/* ADX */}
                              <Stack gap={2} align="center" style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" fw={500}>
                                  ADX
                                </Text>
                                <Text fw={600} size="sm">
                                  {formatNumber(analysis.movementIndex.adx, 2)}
                                </Text>
                              </Stack>

                              {/* PDI */}
                              <Stack gap={2} align="center" style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" fw={500}>
                                  PDI
                                </Text>
                                <Text fw={600} size="sm">
                                  {formatNumber(analysis.movementIndex.pdi, 2)}
                                </Text>
                              </Stack>

                              {/* MDI */}
                              <Stack gap={2} align="center" style={{ flex: 1 }}>
                                <Text size="xs" c="dimmed" fw={500}>
                                  MDI
                                </Text>
                                <Text fw={600} size="sm">
                                  {formatNumber(analysis.movementIndex.mdi, 2)}
                                </Text>
                              </Stack>
                            </Group>
                          </Paper>
                        )}
                      </Grid.Col>

                      {/* Grid 3: Buttons */}
                      <Grid.Col span={{ base: 12, sm: 2 }}>
                        <Stack gap="sm" align="center" justify="center" style={{ height: '100%' }}>
                          <Button variant="light" size="sm" fullWidth>
                            Detay
                          </Button>
                          <Button
                            variant="filled"
                            size="sm"
                            fullWidth
                            onClick={() => handleAnalyze(coin, analysis)}
                            disabled={!analysis || analyzingCoinId === coin.id}
                            leftSection={analyzingCoinId === coin.id ? <Loader size="xs" /> : null}
                          >
                            {analyzingCoinId === coin.id ? "Analiz Yapılıyor..." : "Analiz Yap"}
                          </Button>
                        </Stack>
                      </Grid.Col>
                    </Grid>

                    {/* Analysis Results */}
                    {(analyzingCoinId === coin.id || analysisResults[coin.id] || analysisErrors[coin.id]) && (
                      <>
                        <Divider my="md" />
                        {analyzingCoinId === coin.id ? (
                          <Stack gap="sm">
                            <Group gap="sm" align="center">
                              <Loader size="sm" />
                              <Text fw={500} size="sm" c="dimmed" style={{ 
                                animation: "fadeIn 0.5s ease-in",
                                minHeight: "24px",
                                display: "flex",
                                alignItems: "center"
                              }}>
                                {loadingTexts[loadingTextIndex]}
                              </Text>
                            </Group>
                            <Paper p="md" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                              <Stack gap="sm">
                                <Skeleton height={14} radius="sm" />
                                <Skeleton height={14} radius="sm" width="92%" />
                                <Skeleton height={14} radius="sm" width="88%" />
                                <Skeleton height={14} radius="sm" width="95%" />
                                <Skeleton height={14} radius="sm" width="85%" />
                                <Skeleton height={14} radius="sm" width="90%" />
                              </Stack>
                            </Paper>
                          </Stack>
                        ) : analysisErrors[coin.id] ? (
                          <Alert
                            icon={<IconAlertCircle size={16} />}
                            title="Hata"
                            color="red"
                            variant="light"
                          >
                            {analysisErrors[coin.id]}
                          </Alert>
                        ) : analysisResults[coin.id] ? (
                          <Stack gap="sm">
                            <Group justify="space-between" align="center">
                              <Text fw={600} size="md">
                                AI Analiz Sonuçları
                              </Text>
                              <Button
                                variant="subtle"
                                size="xs"
                                onClick={() => toggleExpanded(coin.id)}
                              >
                                {expandedCoins.has(coin.id) ? "Gizle" : "Göster"}
                              </Button>
                            </Group>
                            {expandedCoins.has(coin.id) ? (
                              <Paper p="md" withBorder radius="md" style={{ backgroundColor: "var(--mantine-color-gray-0)" }}>
                                <Text size="sm" style={{ whiteSpace: "pre-wrap", lineHeight: 1.6 }}>
                                  {analysisResults[coin.id]}
                                </Text>
                              </Paper>
                            ) : null}
                          </Stack>
                        ) : null}
                      </>
                    )}
                  </Paper>
                );
              })}
            </Stack>

            <Footer />
          </Stack>
        </Container>
      </AppShellMain>
    </AppShell>
  );
}
