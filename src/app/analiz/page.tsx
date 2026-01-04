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
  SegmentedControl,
  Tooltip,
  Modal,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { IconAlertCircle } from "@tabler/icons-react";
import { getAnalysisData } from "@/lib/analysis-data";
import { getFavoritesCoins, formatCurrency, formatLargeNumber, formatNumber } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect, useRef } from "react";
import { CryptoCoin } from "@/lib/types";
import { createMultiTickerWebSocket, symbolToBinancePair, updateCoinFromTicker } from "@/lib/binance";
import {
  fetchTaapiValue,
  fetchTaapiFib,
  fetchTaapiBbands,
  fetchTaapiPivot,
  fetchComplexIndicator,
} from "@/lib/taapi-client";

export default function AnalizPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<CryptoCoin[]>([]);
  const [loading, setLoading] = useState(true);
  const [tradingStrategy, setTradingStrategy] = useState<"scalp" | "swing">("swing");
  const [analyzingCoinId, setAnalyzingCoinId] = useState<string | null>(null);
  const [analysisResults, setAnalysisResults] = useState<Record<string, string>>({});
  const [analysisErrors, setAnalysisErrors] = useState<Record<string, string>>({});
  const [expandedCoins, setExpandedCoins] = useState<Set<string>>(new Set());
  const [loadingTextIndex, setLoadingTextIndex] = useState(0);
  const [detailModalOpened, { open: openDetailModal, close: closeDetailModal }] = useDisclosure(false);
  const [selectedCoin, setSelectedCoin] = useState<CryptoCoin | null>(null);
  const [maValue, setMaValue] = useState<number | null>(null);
  const [maLoading, setMaLoading] = useState(false);
  const [maError, setMaError] = useState<string | null>(null);
  const [modalAtrValue, setModalAtrValue] = useState<number | null>(null);
  const [modalAtrLoading, setModalAtrLoading] = useState(false);
  const [modalAtrError, setModalAtrError] = useState<string | null>(null);
  const [modalFibValue, setModalFibValue] = useState<{
    value: number;
    trend: string;
    startPrice: number;
    endPrice: number;
  } | null>(null);
  const [modalFibLoading, setModalFibLoading] = useState(false);
  const [modalFibError, setModalFibError] = useState<string | null>(null);
  const [modalRsiValue, setModalRsiValue] = useState<number | null>(null);
  const [modalRsiLoading, setModalRsiLoading] = useState(false);
  const [modalRsiError, setModalRsiError] = useState<string | null>(null);
  const [modalAdxValue, setModalAdxValue] = useState<number | null>(null);
  const [modalAdxLoading, setModalAdxLoading] = useState(false);
  const [modalAdxError, setModalAdxError] = useState<string | null>(null);
  const [modalVwapValue, setModalVwapValue] = useState<number | null>(null);
  const [modalVwapLoading, setModalVwapLoading] = useState(false);
  const [modalVwapError, setModalVwapError] = useState<string | null>(null);
  const [modalBbandsValue, setModalBbandsValue] = useState<{
    valueUpperBand: number;
    valueMiddleBand: number;
    valueLowerBand: number;
  } | null>(null);
  const [modalBbandsLoading, setModalBbandsLoading] = useState(false);
  const [modalBbandsError, setModalBbandsError] = useState<string | null>(null);
  const [modalPivotValue, setModalPivotValue] = useState<{
    r3: number;
    r2: number;
    r1: number;
    p: number;
    s1: number;
    s2: number;
    s3: number;
  } | null>(null);
  const [modalPivotLoading, setModalPivotLoading] = useState(false);
  const [modalPivotError, setModalPivotError] = useState<string | null>(null);
  
  // Coin kartlarında gösterilecek göstergeler (coin.id bazında)
  const [coinIndicators, setCoinIndicators] = useState<Record<string, {
    ma?: number | null;
    atr?: number | null;
    rsi?: number | null;
    adx?: number | null;
    fib?: { value: number; trend: string; startPrice: number; endPrice: number } | null;
    vwap?: number | null;
    bbands?: { valueUpperBand: number; valueMiddleBand: number; valueLowerBand: number } | null;
    pivot?: { r3: number; r2: number; r1: number; p: number; s1: number; s2: number; s3: number } | null;
  }>>({});
  
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

    const indicators = coinIndicators[coin.id];
    if (!indicators) {
      setAnalysisErrors((prev) => ({
        ...prev,
        [coin.id]: "Lütfen önce 'Detay' butonuna tıklayarak göstergeleri yükleyin.",
      }));
      return;
    }

    setAnalyzingCoinId(coin.id);
    setAnalysisErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[coin.id];
      return newErrors;
    });

    try {
      // Trading strategy'ye göre request body oluştur
      const requestBody: any = {
        coinName: coin.name,
        symbol: coin.symbol,
        price: coin.current_price,
        tradingStrategy: tradingStrategy,
      };

      if (tradingStrategy === "scalp") {
        // Scalping göstergeleri
        if (indicators.atr !== undefined && indicators.atr !== null) {
          requestBody.atr = indicators.atr;
        }
        if (indicators.vwap !== undefined && indicators.vwap !== null) {
          requestBody.vwap = indicators.vwap;
        }
        if (indicators.bbands) {
          requestBody.bbands = {
            upper: indicators.bbands.valueUpperBand,
            middle: indicators.bbands.valueMiddleBand,
            lower: indicators.bbands.valueLowerBand,
          };
        }
        if (indicators.pivot) {
          requestBody.pivot = indicators.pivot;
        }
        if (indicators.rsi !== undefined && indicators.rsi !== null) {
          requestBody.rsi = indicators.rsi;
        }
      } else {
        // Swing trade göstergeleri
        if (indicators.ma !== undefined && indicators.ma !== null) {
          requestBody.ma = indicators.ma;
        }
        if (indicators.atr !== undefined && indicators.atr !== null) {
          requestBody.atr = indicators.atr;
        }
        if (indicators.fib) {
          requestBody.fib = indicators.fib;
        }
        if (indicators.rsi !== undefined && indicators.rsi !== null) {
          requestBody.rsi = indicators.rsi;
        }
        if (indicators.adx !== undefined && indicators.adx !== null) {
          requestBody.adx = indicators.adx;
        }
      }

      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
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

  // Reset all modal states
  const resetModalStates = () => {
    setMaValue(null);
    setMaError(null);
    setModalAtrValue(null);
    setModalAtrError(null);
    setModalFibValue(null);
    setModalFibError(null);
    setModalRsiValue(null);
    setModalRsiError(null);
    setModalAdxValue(null);
    setModalAdxError(null);
    setModalVwapValue(null);
    setModalVwapError(null);
    setModalBbandsValue(null);
    setModalBbandsError(null);
    setModalPivotValue(null);
    setModalPivotError(null);
  };

  // Helper: Populate indicators from cache data
  const populateIndicatorsFromCache = (
    coin: CryptoCoin,
    cachedData: any,
    strategy: "swing" | "scalp"
  ) => {
    if (strategy === "swing") {
      setMaValue(cachedData.ma);
      setModalAtrValue(cachedData.atr);
      setModalRsiValue(cachedData.rsi);
      setModalAdxValue(cachedData.adx);
      if (cachedData.fib_value !== null) {
        setModalFibValue({
          value: cachedData.fib_value,
          trend: cachedData.fib_trend || "N/A",
          startPrice: cachedData.fib_start_price || 0,
          endPrice: cachedData.fib_end_price || 0,
        });
      }
      
      // Update coin indicators state
      setCoinIndicators(prev => ({
        ...prev,
        [coin.id]: {
          ...prev[coin.id],
          ma: cachedData.ma,
          atr: cachedData.atr,
          rsi: cachedData.rsi,
          adx: cachedData.adx,
          fib: cachedData.fib_value !== null ? {
            value: cachedData.fib_value,
            trend: cachedData.fib_trend || "N/A",
            startPrice: cachedData.fib_start_price || 0,
            endPrice: cachedData.fib_end_price || 0,
          } : null,
        },
      }));
    } else {
      setModalAtrValue(cachedData.atr);
      setModalVwapValue(cachedData.vwap);
      setModalRsiValue(cachedData.rsi);
      if (cachedData.bbands_upper !== null) {
        setModalBbandsValue({
          valueUpperBand: cachedData.bbands_upper,
          valueMiddleBand: cachedData.bbands_middle,
          valueLowerBand: cachedData.bbands_lower,
        });
      }
      if (cachedData.pivot_p !== null) {
        setModalPivotValue({
          r3: cachedData.pivot_r3,
          r2: cachedData.pivot_r2,
          r1: cachedData.pivot_r1,
          p: cachedData.pivot_p,
          s1: cachedData.pivot_s1,
          s2: cachedData.pivot_s2,
          s3: cachedData.pivot_s3,
        });
      }
      
      // Update coin indicators state
      setCoinIndicators(prev => ({
        ...prev,
        [coin.id]: {
          ...prev[coin.id],
          atr: cachedData.atr,
          vwap: cachedData.vwap,
          rsi: cachedData.rsi,
          bbands: cachedData.bbands_upper !== null ? {
            valueUpperBand: cachedData.bbands_upper,
            valueMiddleBand: cachedData.bbands_middle,
            valueLowerBand: cachedData.bbands_lower,
          } : null,
          pivot: cachedData.pivot_p !== null ? {
            r3: cachedData.pivot_r3,
            r2: cachedData.pivot_r2,
            r1: cachedData.pivot_r1,
            p: cachedData.pivot_p,
            s1: cachedData.pivot_s1,
            s2: cachedData.pivot_s2,
            s3: cachedData.pivot_s3,
          } : null,
        },
      }));
    }
  };

  const handleDetailClick = async (coin: CryptoCoin) => {
    setSelectedCoin(coin);
    resetModalStates();
    openDetailModal();
    
    // Önce cache'den kontrol et
    try {
      const response = await fetch(
        `/api/indicators?coin_id=${coin.id}&strategy=${tradingStrategy}`
      );
      
      if (response.ok) {
        const result = await response.json();
        
        // Cache varsa ve 1 dakikadan yeniyse kullan
        if (result.data && result.is_fresh) {
          populateIndicatorsFromCache(coin, result.data, tradingStrategy);
          return;
        }
      }
    } catch (error) {
      console.error("Cache fetch error:", error);
      // Cache hatası durumunda fallback'e geç
    }
    
    // Cache yoksa veya eskiyse, mevcut TAAPI çağrılarını yap
    const binanceSymbol = symbolToBinancePair(coin.symbol);
    const rsiInterval = tradingStrategy === "swing" ? "4h" : "1h";
    const atrInterval = tradingStrategy === "swing" ? "4h" : "1h";
    
    // Helper function to fetch and set value (hem modal hem coin kartı için)
    const fetchValue = async (
      endpoint: string,
      interval: string,
      setLoading: (val: boolean) => void,
      setValue: (val: number) => void,
      setError: (val: string | null) => void,
      errorMessage: string,
      indicatorKey?: keyof typeof coinIndicators[string]
    ) => {
      setLoading(true);
      try {
        const value = await fetchTaapiValue(endpoint, binanceSymbol, interval, errorMessage);
        setValue(value);
        setError(null);
        // Coin kartı için de kaydet
        if (indicatorKey) {
          setCoinIndicators(prev => ({
            ...prev,
            [coin.id]: {
              ...prev[coin.id],
              [indicatorKey]: value,
            },
          }));
        }
      } catch (error) {
        console.error(`Error fetching ${endpoint}:`, error);
        setError(error instanceof Error ? error.message : errorMessage);
      } finally {
        setLoading(false);
      }
    };
    
    // ATR ve RSI (her iki strateji için)
    await Promise.all([
      fetchValue("atr", atrInterval, setModalAtrLoading, setModalAtrValue, setModalAtrError, "ATR değeri alınırken bir hata oluştu", "atr"),
      fetchValue("rsi", rsiInterval, setModalRsiLoading, setModalRsiValue, setModalRsiError, "RSI değeri alınırken bir hata oluştu", "rsi"),
    ]);
    
    // Swing trade için göstergeler
    if (tradingStrategy === "swing") {
      await Promise.all([
        fetchValue("ma", "4h", setMaLoading, setMaValue, setMaError, "MA değeri alınırken bir hata oluştu", "ma"),
        fetchValue("adx", "4h", setModalAdxLoading, setModalAdxValue, setModalAdxError, "ADX değeri alınırken bir hata oluştu", "adx"),
        fetchComplexIndicator(
          () => fetchTaapiFib(binanceSymbol, "4h", "Fibonacci değeri alınırken bir hata oluştu"),
          setModalFibLoading,
          (value) => {
            setModalFibValue(value);
            setCoinIndicators(prev => ({
              ...prev,
              [coin.id]: {
                ...prev[coin.id],
                fib: value,
              },
            }));
          },
          setModalFibError,
          "Fibonacci değeri alınırken bir hata oluştu"
        ),
      ]);
    }
    
    // Scalp trade için göstergeler
    if (tradingStrategy === "scalp") {
      await Promise.all([
        fetchValue("vwap", "1h", setModalVwapLoading, setModalVwapValue, setModalVwapError, "VWAP değeri alınırken bir hata oluştu", "vwap"),
        fetchComplexIndicator(
          () => fetchTaapiBbands(binanceSymbol, "1h", "Bollinger Bands değeri alınırken bir hata oluştu"),
          setModalBbandsLoading,
          (value) => {
            setModalBbandsValue(value);
            setCoinIndicators(prev => ({
              ...prev,
              [coin.id]: {
                ...prev[coin.id],
                bbands: value,
              },
            }));
          },
          setModalBbandsError,
          "Bollinger Bands değeri alınırken bir hata oluştu"
        ),
        fetchComplexIndicator(
          () => fetchTaapiPivot(binanceSymbol, "1h", "Pivot Points değeri alınırken bir hata oluştu"),
          setModalPivotLoading,
          (value) => {
            setModalPivotValue(value);
            setCoinIndicators(prev => ({
              ...prev,
              [coin.id]: {
                ...prev[coin.id],
                pivot: value,
              },
            }));
          },
          setModalPivotError,
          "Pivot Points değeri alınırken bir hata oluştu"
        ),
      ]);
    }
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
              <Group justify="space-between" align="center">
                <Title order={1}>Analiz</Title>
                <SegmentedControl
                  value={tradingStrategy}
                  onChange={(value) => setTradingStrategy(value as "scalp" | "swing")}
                  color="blue"
                  data={[
                    { label: "Scalp Trade", value: "scalp" },
                    { label: "Swing Trade", value: "swing" },
                  ]}
                />
              </Group>

            <Stack gap="md">
              {favorites.map((coin) => {
                const analysis = getAnalysisData(coin.id, coin.current_price);
                const indicators = coinIndicators[coin.id] || {};

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
                            {!coinIndicators[coin.id] ? (
                              <Stack gap={4} style={{ width: '100%' }}>
                                <Text fw={600} size="sm">
                                  Sistem Nasıl Çalışır?
                                </Text>
                                <Text size="xs" c="dimmed" style={{ lineHeight: 1.6 }}>
                                  {tradingStrategy === "swing" 
                                    ? "Swing Trade stratejisi için teknik göstergeleri görmek ve AI analiz yapmak için 'Verileri Göster' butonuna tıklayın. Sistem, MA, ATR, Fibonacci, RSI ve ADX göstergelerini yükleyecek ve bu verilerle detaylı bir analiz oluşturacaktır."
                                    : "Scalp Trade stratejisi için teknik göstergeleri görmek ve AI analiz yapmak için 'Verileri Göster' butonuna tıklayın. Sistem, ATR, VWAP, Bollinger Bands, Pivot Points ve RSI göstergelerini yükleyecek ve bu verilerle detaylı bir analiz oluşturacaktır."}
                                </Text>
                              </Stack>
                            ) : (
                              <Group gap="xl" justify="space-between" wrap="nowrap" style={{ width: '100%' }}>
                                {tradingStrategy === "swing" ? (
                                <>
                                  {/* MA */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          Moving Averages (MA) - 8/10
                                        </Text>
                                        <Text size="xs">
                                          Trend yönü belirlemede temel araç. Uzun vadeli MA'lar (50, 100, 200) trend yönü için, kısa vadeli MA'lar (9, 21) giriş/çıkış sinyalleri için kullanılır.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        MA
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.ma !== undefined && indicators.ma !== null ? undefined : "dimmed"}>
                                        {indicators.ma !== undefined && indicators.ma !== null ? formatCurrency(indicators.ma) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* ATR */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          ATR (Average True Range) - 8/10
                                        </Text>
                                        <Text size="xs">
                                          Risk yönetimi için kritik. Stop-loss ve pozisyon büyüklüğü ayarlamasında kullanılır. Volatiliteyi objektif olarak ölçer.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        ATR
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.atr !== undefined && indicators.atr !== null ? undefined : "dimmed"}>
                                        {indicators.atr !== undefined && indicators.atr !== null ? formatNumber(indicators.atr, 2) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* FIB */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          Fibonacci Retracement - 8/10
                                        </Text>
                                        <Text size="xs">
                                          Önemli destek ve direnç seviyelerini belirler. %61.8 seviyesi özellikle güçlü bir seviyedir. Hedef ve stop-loss belirlemede kullanılır.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        FIB
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.fib !== undefined && indicators.fib !== null ? undefined : "dimmed"}>
                                        {indicators.fib !== undefined && indicators.fib !== null ? formatCurrency(indicators.fib.value) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* RSI */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          RSI (Relative Strength Index) - 7/10
                                        </Text>
                                        <Text size="xs">
                                          Momentum tespitinde etkili. Aşırı alım (70+) ve aşırı satım (30-) bölgelerini gösterir. Trend dönüşlerinin erken işaretlerini verebilir.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        RSI
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.rsi !== undefined && indicators.rsi !== null ? undefined : "dimmed"}>
                                        {indicators.rsi !== undefined && indicators.rsi !== null ? formatNumber(indicators.rsi, 2) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* ADX */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          ADX (Average Directional Index) - 7/10
                                        </Text>
                                        <Text size="xs">
                                          Trend gücünü objektif olarak ölçer. 25 üzeri güçlü trend, 20 altı zayıf trend. Trend yönü için MA ile birlikte kullanılmalıdır.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        ADX
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.adx !== undefined && indicators.adx !== null ? undefined : "dimmed"}>
                                        {indicators.adx !== undefined && indicators.adx !== null ? formatNumber(indicators.adx, 2) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>
                                </>
                              ) : (
                                <>
                                  {/* ATR */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          ATR (Average True Range) - 6/10
                                        </Text>
                                        <Text size="xs">
                                          Risk yönetimi için kritik. Scalping'te sık stop-loss ayarlamaları gerektiğinden ATR volatilite ölçümü çok önemlidir.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        ATR
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.atr !== undefined && indicators.atr !== null ? undefined : "dimmed"}>
                                        {indicators.atr !== undefined && indicators.atr !== null ? formatNumber(indicators.atr, 2) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* VWAP */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          VWAP (Volume-Weighted Average Price) - 6/10
                                        </Text>
                                        <Text size="xs">
                                          Günlük işlemlerde güçlü referans noktası. VWAP üzerindeki fiyatlar yükseliş, altındaki fiyatlar düşüş sinyali. Günlük intraday için kullanılır.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        VWAP
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.vwap !== undefined && indicators.vwap !== null ? undefined : "dimmed"}>
                                        {indicators.vwap !== undefined && indicators.vwap !== null ? formatCurrency(indicators.vwap) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* BOL */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          Bollinger Bands - 5/10
                                        </Text>
                                        <Text size="xs">
                                          Volatilite ve potansiyel dönüş noktalarını gösterir. Bantların daralması (squeeze) büyük hareket öncesi sinyal verebilir.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        BOL
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.bbands !== undefined && indicators.bbands !== null ? undefined : "dimmed"}>
                                        {indicators.bbands !== undefined && indicators.bbands !== null ? formatCurrency(indicators.bbands.valueMiddleBand) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* PIVOT */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          Pivot Points - 5/10
                                        </Text>
                                        <Text size="xs">
                                          Kısa vadeli destek ve direnç seviyelerini belirler. R1, R2, R3 (direnç) ve S1, S2, S3 (destek) seviyeleri hedef ve stop-loss için kullanılır.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        PIVOT
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.pivot !== undefined && indicators.pivot !== null ? undefined : "dimmed"}>
                                        {indicators.pivot !== undefined && indicators.pivot !== null ? formatCurrency(indicators.pivot.p) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>

                                  {/* RSI */}
                                  <Tooltip
                                    label={
                                      <div>
                                        <Text size="sm" fw={600} mb={4}>
                                          RSI (Relative Strength Index) - 4/10
                                        </Text>
                                        <Text size="xs">
                                          Kısa vadeli momentum tespiti için kullanılır. 4H grafikte sınırlı olsa da, daha küçük zaman dilimlerinde (15dk-1s) etkilidir.
                                        </Text>
                                      </div>
                                    }
                                    multiline
                                    w={300}
                                    withArrow
                                  >
                                    <Stack gap={2} align="center" style={{ flex: 1, cursor: "help" }}>
                                      <Text size="xs" c="dimmed" fw={500}>
                                        RSI
                                      </Text>
                                      <Text fw={600} size="sm" c={indicators.rsi !== undefined && indicators.rsi !== null ? undefined : "dimmed"}>
                                        {indicators.rsi !== undefined && indicators.rsi !== null ? formatNumber(indicators.rsi, 2) : "?"}
                                      </Text>
                                    </Stack>
                                  </Tooltip>
                                </>
                              )}
                              </Group>
                            )}
                          </Paper>
                        )}
                      </Grid.Col>

                      {/* Grid 3: Buttons */}
                      <Grid.Col span={{ base: 12, sm: 2 }}>
                        <Stack gap="sm" align="center" justify="center" style={{ height: '100%' }}>
                          <Button 
                            variant="light" 
                            size="sm" 
                            fullWidth
                            onClick={() => handleDetailClick(coin)}
                          >
                            Verileri Göster
                          </Button>
                          <Button
                            variant="filled"
                            size="sm"
                            fullWidth
                            onClick={() => handleAnalyze(coin, analysis)}
                            disabled={!analysis || analyzingCoinId === coin.id || !coinIndicators[coin.id]}
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

      {/* Detail Modal */}
      <Modal
        opened={detailModalOpened}
        onClose={closeDetailModal}
        title={selectedCoin ? `${selectedCoin.name} Detayları` : "Detaylar"}
        size="lg"
      >
        {selectedCoin && (
          <Stack gap="md">
            <Group gap="md">
              <Avatar src={selectedCoin.image} alt={selectedCoin.name} size="lg" />
              <Stack gap={4}>
                <Text fw={700} size="lg">
                  {selectedCoin.name}
                </Text>
                <Text c="dimmed" size="sm" tt="uppercase">
                  {selectedCoin.symbol}
                </Text>
                <Text fw={600} size="xl">
                  {formatCurrency(selectedCoin.current_price)}
                </Text>
              </Stack>
            </Group>

            <Divider />

            {tradingStrategy === "swing" ? (
              <>
                {/* Swing Trade: MA, ATR, Fibonacci, RSI, ADX */}
                <Stack gap="sm">
                  <Text fw={600} size="md">
                    Moving Averages (MA) - 8/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Trend yönü belirlemede temel araç. Uzun vadeli MA'lar (50, 100, 200) trend yönü için, kısa vadeli MA'lar (9, 21) giriş/çıkış sinyalleri için kullanılır.
                  </Text>
                  {maLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : maError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{maError}</Text>
                    </Alert>
                  ) : maValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatCurrency(maValue)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    ATR (Average True Range) - 8/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Risk yönetimi için kritik. Stop-loss ve pozisyon büyüklüğü ayarlamasında kullanılır. Volatiliteyi objektif olarak ölçer.
                  </Text>
                  {modalAtrLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalAtrError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalAtrError}</Text>
                    </Alert>
                  ) : modalAtrValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatNumber(modalAtrValue, 2)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    Fibonacci Retracement - 8/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Önemli destek ve direnç seviyelerini belirler. %61.8 seviyesi özellikle güçlü bir seviyedir. Hedef ve stop-loss belirlemede kullanılır.
                  </Text>
                  {modalFibLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalFibError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalFibError}</Text>
                    </Alert>
                  ) : modalFibValue !== null ? (
                    <Stack gap="xs">
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Değer:</Text>
                        <Text fw={600} size="lg">
                          {formatCurrency(modalFibValue.value)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Trend:</Text>
                        <Badge 
                          color={modalFibValue.trend === "UPTREND" ? "green" : "red"} 
                          variant="light"
                        >
                          {modalFibValue.trend}
                        </Badge>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Başlangıç Fiyatı:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalFibValue.startPrice)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Bitiş Fiyatı:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalFibValue.endPrice)}
                        </Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    RSI (Relative Strength Index) - 7/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Momentum tespitinde etkili. Aşırı alım (70+) ve aşırı satım (30-) bölgelerini gösterir. Trend dönüşlerinin erken işaretlerini verebilir.
                  </Text>
                  {modalRsiLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalRsiError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalRsiError}</Text>
                    </Alert>
                  ) : modalRsiValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatNumber(modalRsiValue, 2)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    ADX (Average Directional Index) - 7/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Trend gücünü objektif olarak ölçer. 25 üzeri güçlü trend, 20 altı zayıf trend. Trend yönü için MA ile birlikte kullanılmalıdır.
                  </Text>
                  {modalAdxLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalAdxError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalAdxError}</Text>
                    </Alert>
                  ) : modalAdxValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatNumber(modalAdxValue, 2)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>
              </>
            ) : (
              <>
                {/* Scalp Trade: ATR, VWAP, Bollinger Bands, Pivot Points, RSI */}
                <Stack gap="sm">
                  <Text fw={600} size="md">
                    ATR (Average True Range) - 6/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Risk yönetimi için kritik. Scalping'te sık stop-loss ayarlamaları gerektiğinden ATR volatilite ölçümü çok önemlidir.
                  </Text>
                  {modalAtrLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalAtrError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalAtrError}</Text>
                    </Alert>
                  ) : modalAtrValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatNumber(modalAtrValue, 2)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    VWAP (Volume-Weighted Average Price) - 6/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Günlük işlemlerde güçlü referans noktası. VWAP üzerindeki fiyatlar yükseliş, altındaki fiyatlar düşüş sinyali. Günlük intraday için kullanılır.
                  </Text>
                  {modalVwapLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalVwapError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalVwapError}</Text>
                    </Alert>
                  ) : modalVwapValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatCurrency(modalVwapValue)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    Bollinger Bands - 5/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Volatilite ve potansiyel dönüş noktalarını gösterir. Bantların daralması (squeeze) büyük hareket öncesi sinyal verebilir.
                  </Text>
                  {modalBbandsLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalBbandsError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalBbandsError}</Text>
                    </Alert>
                  ) : modalBbandsValue !== null ? (
                    <Stack gap="xs">
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Üst Bant:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalBbandsValue.valueUpperBand)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Orta Bant:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalBbandsValue.valueMiddleBand)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed">Alt Bant:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalBbandsValue.valueLowerBand)}
                        </Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    Pivot Points - 5/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Kısa vadeli destek ve direnç seviyelerini belirler. R1, R2, R3 (direnç) ve S1, S2, S3 (destek) seviyeleri hedef ve stop-loss için kullanılır.
                  </Text>
                  {modalPivotLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalPivotError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalPivotError}</Text>
                    </Alert>
                  ) : modalPivotValue !== null ? (
                    <Stack gap="xs">
                      <Group gap="md">
                        <Text size="sm" c="dimmed" fw={600}>Direnç Seviyeleri:</Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">R3:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.r3)}
                        </Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">R2:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.r2)}
                        </Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">R1:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.r1)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed" fw={600}>Pivot:</Text>
                        <Text fw={600} size="sm">
                          {formatCurrency(modalPivotValue.p)}
                        </Text>
                      </Group>
                      <Group gap="md">
                        <Text size="sm" c="dimmed" fw={600}>Destek Seviyeleri:</Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">S1:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.s1)}
                        </Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">S2:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.s2)}
                        </Text>
                      </Group>
                      <Group gap="md" pl="md">
                        <Text size="sm" c="dimmed">S3:</Text>
                        <Text fw={500} size="sm">
                          {formatCurrency(modalPivotValue.s3)}
                        </Text>
                      </Group>
                    </Stack>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>

                <Divider />

                <Stack gap="sm">
                  <Text fw={600} size="md">
                    RSI (Relative Strength Index) - 4/10
                  </Text>
                  <Text size="xs" c="dimmed" mb="xs">
                    Kısa vadeli momentum tespiti için kullanılır. 4H grafikte sınırlı olsa da, daha küçük zaman dilimlerinde (15dk-1s) etkilidir.
                  </Text>
                  {modalRsiLoading ? (
                    <Group gap="sm">
                      <Loader size="sm" />
                      <Text size="sm" c="dimmed">Yükleniyor...</Text>
                    </Group>
                  ) : modalRsiError ? (
                    <Alert color="red" variant="light">
                      <Text size="sm">{modalRsiError}</Text>
                    </Alert>
                  ) : modalRsiValue !== null ? (
                    <Text fw={600} size="lg">
                      {formatNumber(modalRsiValue, 2)}
                    </Text>
                  ) : (
                    <Text size="sm" c="dimmed">?</Text>
                  )}
                </Stack>
              </>
            )}
          </Stack>
        )}
      </Modal>
    </AppShell>
  );
}
