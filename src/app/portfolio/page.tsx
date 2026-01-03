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
  Button,
  Table,
  Avatar,
  ActionIcon,
  Progress,
  SimpleGrid,
  Box,
  Tooltip,
} from "@mantine/core";
import { IconStarFilled, IconTrash, IconArrowUpRight, IconWallet } from "@tabler/icons-react";
import { getFavoritesCoins, formatCurrency, formatLargeNumber, formatPercentage, removeFavorite } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { useState, useEffect } from "react";
import Link from "next/link";
import { CryptoCoin } from "@/lib/types";

// Renk paleti
const colors = [
  "#47d6ab",
  "#03141a",
  "#4fcdf7",
  "#ff6b6b",
  "#4ecdc4",
  "#45b7d1",
  "#f9ca24",
  "#6c5ce7",
  "#a29bfe",
  "#fd79a8",
];

export default function PortfolioPage() {
  const { user } = useAuth();
  const [favorites, setFavorites] = useState<CryptoCoin[]>([]);
  const [totalValue, setTotalValue] = useState(0);
  const [totalChange, setTotalChange] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadFavorites();
    } else {
      setFavorites([]);
      setTotalValue(0);
      setTotalChange(0);
      setLoading(false);
    }
  }, [user?.id]);

  const loadFavorites = async () => {
    if (!user?.id) return;
    
    setLoading(true);
    try {
      const favoriteCoins = await getFavoritesCoins(user.id);
      setFavorites(favoriteCoins);
      const total = favoriteCoins.reduce((sum, coin) => sum + coin.current_price, 0);
      setTotalValue(total);
      
      // Toplam değişim hesapla (ağırlıklı ortalama)
      const weightedChange = total > 0
        ? favoriteCoins.reduce((sum, coin) => {
            const weight = coin.current_price / total;
            return sum + coin.price_change_percentage_24h * weight;
          }, 0)
        : 0;
      setTotalChange(weightedChange);
    } catch (error) {
      console.error("Error loading favorites:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (coinId: string) => {
    if (!user?.id) return;
    
    try {
      await removeFavorite(user.id, coinId);
      const updated = favorites.filter((coin) => coin.id !== coinId);
      setFavorites(updated);
      
      if (updated.length === 0) {
        setTotalValue(0);
        setTotalChange(0);
        return;
      }
      
      const newTotal = updated.reduce((sum, coin) => sum + coin.current_price, 0);
      setTotalValue(newTotal);
      
      const weightedChange = updated.reduce((sum, coin) => {
        const weight = coin.current_price / newTotal;
        return sum + coin.price_change_percentage_24h * weight;
      }, 0);
      setTotalChange(weightedChange);
    } catch (error) {
      console.error("Error removing favorite:", error);
    }
  };

  // Coin segment verileri
  const coinSegments = favorites.map((coin, index) => {
    const part = totalValue > 0 ? (coin.current_price / totalValue) * 100 : 0;
    return {
      coin,
      part: Math.round(part * 10) / 10,
      color: colors[index % colors.length],
    };
  });

  const segments = coinSegments.map((segment) => (
    <Progress.Section
      value={segment.part}
      color={segment.color}
      key={segment.coin.id}
    >
      {segment.part > 5 && <Progress.Label>{segment.part}%</Progress.Label>}
    </Progress.Section>
  ));

  const descriptions = coinSegments.map((segment) => (
    <Box
      key={segment.coin.id}
      style={{ borderBottomColor: segment.color }}
      className="pb-2 border-b-2"
    >
      <Text tt="uppercase" fz="xs" c="dimmed" fw={700}>
        {segment.coin.name}
      </Text>
      <Group justify="space-between" align="flex-end" gap={0}>
        <Text fw={700}>{formatCurrency(segment.coin.current_price)}</Text>
        <Text c={segment.color} fw={700} size="sm">
          {segment.part.toFixed(1)}%
        </Text>
      </Group>
    </Box>
  ));

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
              <IconStarFilled size={64} className="text-gray-400" />
              <Title order={2}>Giriş Yapın</Title>
              <Text c="dimmed" ta="center">
                Favorilerinizi görmek için giriş yapmanız gerekiyor.
              </Text>
              <Button component={Link} href="/login" variant="filled">
                Giriş Yap
              </Button>
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
              <IconStarFilled size={64} className="text-gray-400" />
              <Title order={2}>Favori Coin Yok</Title>
              <Text c="dimmed" ta="center">
                Favorilerinize coin eklemek için ana sayfadaki yıldız ikonuna tıklayın.
              </Text>
              <Button component={Link} href="/" variant="filled">
                Ana Sayfaya Dön
              </Button>
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
            <Title order={1}>Portföy</Title>

            {/* Total Value Card */}
            <Paper withBorder p="md" radius="md">
              <Group justify="space-between">
                <Group align="flex-end" gap="xs">
                  <Text fz="xl" fw={700}>
                    {formatCurrency(totalValue)}
                  </Text>
                  {totalChange !== 0 && (
                    <Text
                      c={totalChange >= 0 ? "teal" : "red"}
                      className="flex items-center gap-1"
                      fz="sm"
                      fw={700}
                    >
                      <span>{formatPercentage(totalChange)}</span>
                      <IconArrowUpRight
                        size={16}
                        style={{
                          marginBottom: 4,
                          transform: totalChange < 0 ? "rotate(180deg)" : "none",
                        }}
                        stroke={1.5}
                      />
                    </Text>
                  )}
                </Group>
                <IconWallet size={22} className="text-gray-400" stroke={1.5} />
              </Group>

              <Text c="dimmed" fz="sm" mt="xs">
                Toplam Portföy Değeri
              </Text>

              {favorites.length > 0 && (
                <>
                  <Progress.Root size={34} mt={40}>
                    {segments}
                  </Progress.Root>
                  <SimpleGrid cols={{ base: 1, xs: Math.min(favorites.length, 3) }} mt="xl">
                    {descriptions}
                  </SimpleGrid>
                </>
              )}
            </Paper>

            {/* Favorites Table */}
            <Paper p="md" withBorder>
              <Title order={3} mb="md">
                Favori Coinler
              </Title>
              <Table.ScrollContainer minWidth={600}>
                <Table highlightOnHover>
                  <Table.Thead>
                    <Table.Tr>
                      <Table.Th>Coin</Table.Th>
                      <Table.Th>Fiyat</Table.Th>
                      <Table.Th>24s Değişim</Table.Th>
                      <Table.Th>Market Cap</Table.Th>
                      <Table.Th>İşlem</Table.Th>
                    </Table.Tr>
                  </Table.Thead>
                  <Table.Tbody>
                    {favorites.map((coin) => {
                      const isPositive = coin.price_change_percentage_24h >= 0;
                      return (
                        <Table.Tr key={coin.id}>
                          <Table.Td>
                            <Link
                              href={`/coins/${coin.id}`}
                              className="no-underline text-inherit"
                            >
                              <Group gap="sm">
                                <Avatar src={coin.image} alt={coin.name} size="sm" />
                                <Stack gap={0}>
                                  <Text fw={500} size="sm">
                                    {coin.name}
                                  </Text>
                                  <Text size="xs" c="dimmed" tt="uppercase">
                                    {coin.symbol}
                                  </Text>
                                </Stack>
                              </Group>
                            </Link>
                          </Table.Td>
                          <Table.Td>
                            <Text fw={500}>{formatCurrency(coin.current_price)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Badge color={isPositive ? "green" : "red"} variant="light">
                              {formatPercentage(coin.price_change_percentage_24h)}
                            </Badge>
                          </Table.Td>
                          <Table.Td>
                            <Text size="sm">{formatLargeNumber(coin.market_cap)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Tooltip label="Favorilerden Çıkar">
                              <ActionIcon
                                color="red"
                                variant="subtle"
                                onClick={() => handleRemoveFavorite(coin.id)}
                              >
                                <IconTrash size={18} />
                              </ActionIcon>
                            </Tooltip>
                          </Table.Td>
                        </Table.Tr>
                      );
                    })}
                  </Table.Tbody>
                </Table>
              </Table.ScrollContainer>
            </Paper>
            <Footer />
          </Stack>
        </Container>
      </AppShellMain>
    </AppShell>
  );
}
