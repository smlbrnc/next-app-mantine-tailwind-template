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
  Select,
  Table,
  Badge,
  Skeleton,
  Alert,
  Grid,
  Divider,
} from "@mantine/core";
import { IconAlertCircle, IconArrowUpRight, IconArrowDownRight } from "@tabler/icons-react";
import { getTicker24hr, getOrderBook, getRecentTrades, createBinanceWebSocket } from "@/lib/binance";
import { BinanceTicker24hr, BinanceOrderBook, BinanceTrade } from "@/lib/types";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { formatCurrency, formatPercentage, formatLargeNumber } from "@/lib/utils";

const POPULAR_SYMBOLS = [
  { value: "BTCUSDT", label: "BTC/USDT" },
  { value: "ETHUSDT", label: "ETH/USDT" },
  { value: "BNBUSDT", label: "BNB/USDT" },
  { value: "SOLUSDT", label: "SOL/USDT" },
  { value: "ADAUSDT", label: "ADA/USDT" },
  { value: "XRPUSDT", label: "XRP/USDT" },
  { value: "DOGEUSDT", label: "DOGE/USDT" },
  { value: "DOTUSDT", label: "DOT/USDT" },
];

export default function MarketPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("BTCUSDT");
  const [ticker, setTicker] = useState<BinanceTicker24hr | null>(null);
  const [orderBook, setOrderBook] = useState<BinanceOrderBook | null>(null);
  const [trades, setTrades] = useState<BinanceTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const tradesBufferRef = useRef<BinanceTrade[]>([]);

  // İlk yükleme - REST API ile
  const loadInitialData = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      const [tickerData, orderBookData, tradesData] = await Promise.all([
        getTicker24hr(selectedSymbol),
        getOrderBook(selectedSymbol, 20),
        getRecentTrades(selectedSymbol, 20),
      ]);
      
      setTicker(tickerData);
      setOrderBook(orderBookData);
      setTrades(tradesData);
      tradesBufferRef.current = tradesData;
    } catch (err) {
      console.error("Error loading market data:", err);
      setError(err instanceof Error ? err.message : "Market verileri yüklenirken bir hata oluştu");
    } finally {
      setLoading(false);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    // İlk yükleme - REST API ile snapshot al
    loadInitialData();

    // Eski WebSocket bağlantısını kapat
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // WebSocket bağlantısı oluştur - API'den veri geldikçe güncelle
    const ws = createBinanceWebSocket(selectedSymbol, {
      onTicker: (data) => {
        // Ticker verileri API'den geldikçe güncelle
        setTicker(data);
      },
      onDepth: (data) => {
        // Depth güncellemeleri API'den geldikçe orderbook'u güncelle
        setOrderBook((prev) => {
          // İlk yükleme tamamlanmamışsa snapshot'ı kullan
          if (!prev) {
            return data;
          }
          // Incremental update - yeni verilerle güncelle
          return {
            lastUpdateId: data.lastUpdateId,
            bids: data.bids.length > 0 ? data.bids : prev.bids,
            asks: data.asks.length > 0 ? data.asks : prev.asks,
          };
        });
      },
      onTrade: (data) => {
        // Yeni trade API'den geldikçe listenin başına ekle
        setTrades((prev) => {
          const newTrades = [data, ...prev].slice(0, 20);
          return newTrades;
        });
      },
      onError: (error) => {
        console.error("WebSocket error:", error);
        setError("WebSocket bağlantısında bir hata oluştu");
      },
    });

    wsRef.current = ws;

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [selectedSymbol, loadInitialData]);

  const priceChange = useMemo(() => {
    return ticker ? parseFloat(ticker.priceChangePercent) : 0;
  }, [ticker?.priceChangePercent]);
  
  const isPositive = useMemo(() => priceChange >= 0, [priceChange]);

  return (
    <AppShell header={{ height: 110 }} padding={0}>
      <HeaderMenu />
      <AppShellMain className="pt-4">
        <Container size="xl">
          <Stack gap="xl">
            <Title order={1}>Market</Title>

            {/* Coin Selection */}
            <Paper p="md" withBorder radius="md">
              <Stack gap="md">
                <Text fw={600} size="md">
                  Coin Seçimi
                </Text>
                <Select
                  label="Coin"
                  placeholder="Coin seçin"
                  data={POPULAR_SYMBOLS}
                  value={selectedSymbol}
                  onChange={(value) => value && setSelectedSymbol(value)}
                  searchable
                />
              </Stack>
            </Paper>

            {/* Error Alert */}
            {error && (
              <Alert
                icon={<IconAlertCircle size={16} />}
                title="Hata"
                color="red"
                variant="light"
              >
                {error}
              </Alert>
            )}

            {/* Ticker Data */}
            <Paper p="md" withBorder radius="md">
              <Stack gap="md">
                <Title order={3}>24 Saatlik İstatistikler</Title>
                {loading ? (
                  <Stack gap="sm">
                    <Skeleton height={20} />
                    <Skeleton height={20} width="80%" />
                    <Skeleton height={20} width="90%" />
                  </Stack>
                ) : ticker ? (
                  <Grid>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Fiyat
                        </Text>
                        <Text fw={700} size="xl">
                          {formatCurrency(parseFloat(ticker.lastPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          24s Değişim
                        </Text>
                        <Group gap="xs" align="center">
                          {isPositive ? (
                            <IconArrowUpRight size={16} color="var(--mantine-color-green-6)" />
                          ) : (
                            <IconArrowDownRight size={16} color="var(--mantine-color-red-6)" />
                          )}
                          <Text
                            fw={600}
                            size="lg"
                            c={isPositive ? "green" : "red"}
                          >
                            {formatPercentage(priceChange)}
                          </Text>
                        </Group>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          24s Yüksek
                        </Text>
                        <Text fw={600} size="md" c="green">
                          {formatCurrency(parseFloat(ticker.highPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          24s Düşük
                        </Text>
                        <Text fw={600} size="md" c="red">
                          {formatCurrency(parseFloat(ticker.lowPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Hacim (24s)
                        </Text>
                        <Text fw={600} size="md">
                          {formatLargeNumber(parseFloat(ticker.volume))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Alış Fiyatı (Bid)
                        </Text>
                        <Text fw={600} size="md">
                          {formatCurrency(parseFloat(ticker.bidPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Satış Fiyatı (Ask)
                        </Text>
                        <Text fw={600} size="md">
                          {formatCurrency(parseFloat(ticker.askPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                    <Grid.Col span={{ base: 12, sm: 6, md: 3 }}>
                      <Stack gap={4}>
                        <Text size="xs" c="dimmed">
                          Ortalama Fiyat
                        </Text>
                        <Text fw={600} size="md">
                          {formatCurrency(parseFloat(ticker.weightedAvgPrice))}
                        </Text>
                      </Stack>
                    </Grid.Col>
                  </Grid>
                ) : null}
              </Stack>
            </Paper>

            <Grid>
              {/* Order Book */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder radius="md">
                  <Stack gap="md">
                    <Title order={3}>Orderbook (Alış/Satış)</Title>
                    {loading ? (
                      <Stack gap="xs">
                        {[...Array(10)].map((_, i) => (
                          <Skeleton key={i} height={24} />
                        ))}
                      </Stack>
                    ) : orderBook ? (
                      <Stack gap="xs">
                        {/* Asks (Satış) */}
                        <Text size="sm" fw={600} c="red">
                          Satış (Asks)
                        </Text>
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Fiyat</Table.Th>
                              <Table.Th>Miktar</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {orderBook.asks.slice(0, 10).reverse().map((ask, index) => (
                              <Table.Tr key={index}>
                                <Table.Td c="red" fw={500}>
                                  {formatCurrency(parseFloat(ask[0]))}
                                </Table.Td>
                                <Table.Td>{parseFloat(ask[1]).toFixed(4)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>

                        <Divider />

                        {/* Bids (Alış) */}
                        <Text size="sm" fw={600} c="green">
                          Alış (Bids)
                        </Text>
                        <Table>
                          <Table.Thead>
                            <Table.Tr>
                              <Table.Th>Fiyat</Table.Th>
                              <Table.Th>Miktar</Table.Th>
                            </Table.Tr>
                          </Table.Thead>
                          <Table.Tbody>
                            {orderBook.bids.slice(0, 10).map((bid, index) => (
                              <Table.Tr key={index}>
                                <Table.Td c="green" fw={500}>
                                  {formatCurrency(parseFloat(bid[0]))}
                                </Table.Td>
                                <Table.Td>{parseFloat(bid[1]).toFixed(4)}</Table.Td>
                              </Table.Tr>
                            ))}
                          </Table.Tbody>
                        </Table>
                      </Stack>
                    ) : null}
                  </Stack>
                </Paper>
              </Grid.Col>

              {/* Recent Trades */}
              <Grid.Col span={{ base: 12, md: 6 }}>
                <Paper p="md" withBorder radius="md">
                  <Stack gap="md">
                    <Title order={3}>Son İşlemler</Title>
                    {loading ? (
                      <Stack gap="xs">
                        {[...Array(10)].map((_, i) => (
                          <Skeleton key={i} height={24} />
                        ))}
                      </Stack>
                    ) : trades.length > 0 ? (
                      <Table>
                        <Table.Thead>
                          <Table.Tr>
                            <Table.Th>Fiyat</Table.Th>
                            <Table.Th>Miktar</Table.Th>
                            <Table.Th>Zaman</Table.Th>
                            <Table.Th>Tip</Table.Th>
                          </Table.Tr>
                        </Table.Thead>
                        <Table.Tbody>
                          {trades.slice(0, 20).map((trade) => (
                            <Table.Tr key={trade.id}>
                              <Table.Td fw={500}>
                                {formatCurrency(parseFloat(trade.price))}
                              </Table.Td>
                              <Table.Td>{parseFloat(trade.qty).toFixed(4)}</Table.Td>
                              <Table.Td>
                                {new Date(trade.time).toLocaleTimeString("tr-TR")}
                              </Table.Td>
                              <Table.Td>
                                <Badge
                                  color={trade.isBuyerMaker ? "red" : "green"}
                                  variant="light"
                                  size="sm"
                                >
                                  {trade.isBuyerMaker ? "Satış" : "Alış"}
                                </Badge>
                              </Table.Td>
                            </Table.Tr>
                          ))}
                        </Table.Tbody>
                      </Table>
                    ) : null}
                  </Stack>
                </Paper>
              </Grid.Col>
            </Grid>

            <Footer />
          </Stack>
        </Container>
      </AppShellMain>
    </AppShell>
  );
}
