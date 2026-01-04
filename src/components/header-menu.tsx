"use client";

import { useState } from "react";
import {
  IconChevronDown,
  IconSettings,
  IconLogout,
  IconStar,
  IconHeart,
  IconBook,
} from "@tabler/icons-react";
import {
  Avatar,
  Burger,
  Group,
  Menu,
  Tabs,
  Text,
  UnstyledButton,
  useMantineTheme,
  Button,
  Drawer,
  Stack,
  Divider,
  NavLink,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import { Logo } from "./logo";
import { AuthModal } from "./auth-modal";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

const tabs = [
  { value: "/", label: "Ana Sayfa" },
  { value: "/portfolio", label: "Portföy" },
  { value: "/analiz", label: "Analiz" },
  { value: "/trade", label: "Trade" },
  { value: "/docs", label: "Teknik Göstergeler" },
];

export function HeaderMenu() {
  const theme = useMantineTheme();
  const { user, signOut, loading: authLoading } = useAuth();
  const [opened, { toggle }] = useDisclosure(false);
  const [userMenuOpened, { open: openUserMenu, close: closeUserMenu }] = useDisclosure(false);
  const [authModalOpened, { open: openAuthModal, close: closeAuthModal }] = useDisclosure(false);
  const [authView, setAuthView] = useState<"login" | "register" | "forgot-password">("login");
  const pathname = usePathname();
  const router = useRouter();

  // Aktif tab'ı pathname'e göre belirle
  const activeTab = tabs.find((tab) => tab.value === pathname)?.value || "/";

  const handleTabChange = (value: string | null) => {
    if (value) {
      router.push(value);
    }
  };

  const tabItems = tabs.map((tab) => (
    <Tabs.Tab value={tab.value} key={tab.value}>
      {tab.label}
    </Tabs.Tab>
  ));

  return (
    <div className="border-b border-gray-200 dark:border-gray-800 w-full">
      <div className="w-full max-w-7xl mx-auto px-4 py-3">
        <Group justify="space-between">
          <Logo size={28} />

          <Burger opened={opened} onClick={toggle} hiddenFrom="xs" size="sm" />

          {!authLoading && (
            <>
              {user ? (
                <div className="hidden sm:block">
                  <Menu
                    width={260}
                    position="bottom-end"
                    transitionProps={{ transition: "pop-top-right" }}
                    onClose={closeUserMenu}
                    onOpen={openUserMenu}
                    withinPortal
                  >
                    <Menu.Target>
                      <UnstyledButton
                        className={`flex items-center gap-2 px-2 py-1 rounded-md transition-colors ${
                          userMenuOpened
                            ? "bg-gray-100 dark:bg-gray-800"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <Group gap={7}>
                          <Avatar
                            src={user.user_metadata?.avatar_url}
                            alt={user.email?.split("@")[0] || "User"}
                            radius="xl"
                            size={20}
                          />
                          <div style={{ flex: 1 }} className="min-w-0">
                            <Text size="sm" fw={500} truncate>
                              {user.user_metadata?.full_name || user.email?.split("@")[0] || "Kullanıcı"}
                            </Text>
                            <Text c="dimmed" size="xs" truncate>
                              {user.email || ""}
                            </Text>
                          </div>
                          <IconChevronDown size={12} stroke={1.5} />
                        </Group>
                      </UnstyledButton>
                    </Menu.Target>
                    <Menu.Dropdown>
                      <Menu.Item
                        leftSection={<IconStar size={16} color={theme.colors.yellow[6]} stroke={1.5} />}
                        component={Link}
                        href="/portfolio"
                      >
                        Favorilerim
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconHeart size={16} color={theme.colors.red[6]} stroke={1.5} />}
                      >
                        Beğenilen Coinler
                      </Menu.Item>

                      <Menu.Label>Ayarlar</Menu.Label>
                      <Menu.Item
                        leftSection={<IconSettings size={16} stroke={1.5} />}
                        component={Link}
                        href="/settings"
                      >
                        Hesap Ayarları
                      </Menu.Item>
                      <Menu.Item
                        leftSection={<IconLogout size={16} stroke={1.5} />}
                        onClick={() => signOut()}
                      >
                        Çıkış Yap
                      </Menu.Item>
                    </Menu.Dropdown>
                  </Menu>
                </div>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    setAuthView("login");
                    openAuthModal();
                  }}
                >
                  Giriş Yap
                </Button>
              )}
            </>
          )}
        </Group>
      </div>
      <div className="w-full max-w-7xl mx-auto px-4">
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          variant="default"
          visibleFrom="sm"
          classNames={{
            root: "border-0",
            list: "border-0",
            tab: "data-[active=true]:text-blue-600 dark:data-[active=true]:text-blue-400 data-[active=true]:bg-transparent",
          }}
        >
          <Tabs.List>{tabItems}</Tabs.List>
        </Tabs>
      </div>

      {/* Mobil Drawer */}
      <Drawer
        opened={opened}
        onClose={toggle}
        position="right"
        title="Menü"
        padding="md"
        hiddenFrom="sm"
      >
        <Stack gap="md">
          {/* Menü Linkleri */}
          <Stack gap="xs">
            <NavLink
              component={Link}
              href="/"
              label="Ana Sayfa"
              active={pathname === "/"}
              onClick={toggle}
            />
            <NavLink
              component={Link}
              href="/portfolio"
              label="Portföy"
              active={pathname === "/portfolio"}
              onClick={toggle}
            />
            <NavLink
              component={Link}
              href="/analiz"
              label="Analiz"
              active={pathname === "/analiz"}
              onClick={toggle}
            />
            <NavLink
              component={Link}
              href="/trade"
              label="Trade"
              active={pathname === "/trade"}
              onClick={toggle}
            />
            <NavLink
              component={Link}
              href="/docs"
              label="Teknik Göstergeler"
              active={pathname === "/docs"}
              leftSection={<IconBook size={16} />}
              onClick={toggle}
            />
          </Stack>

          <Divider />

          {/* User Bilgileri */}
          {!authLoading && (
            <>
              {user ? (
                <Stack gap="md">
                  <Group gap="sm">
                    <Avatar
                      src={user.user_metadata?.avatar_url}
                      alt={user.email?.split("@")[0] || "User"}
                      radius="xl"
                      size="md"
                    />
                    <div style={{ flex: 1 }}>
                      <Text size="sm" fw={500}>
                        {user.user_metadata?.full_name || user.email?.split("@")[0] || "Kullanıcı"}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {user.email || ""}
                      </Text>
                    </div>
                  </Group>

                  <Divider />

                  <Stack gap="xs">
                    <NavLink
                      component={Link}
                      href="/portfolio"
                      label="Favorilerim"
                      leftSection={<IconStar size={16} color={theme.colors.yellow[6]} />}
                      onClick={toggle}
                    />
                    <NavLink
                      label="Beğenilen Coinler"
                      leftSection={<IconHeart size={16} color={theme.colors.red[6]} />}
                      onClick={toggle}
                    />
                  </Stack>

                  <Divider />

                  <Stack gap="xs">
                    <NavLink
                      component={Link}
                      href="/settings"
                      label="Hesap Ayarları"
                      leftSection={<IconSettings size={16} />}
                      active={pathname === "/settings"}
                      onClick={toggle}
                    />
                    <NavLink
                      label="Çıkış Yap"
                      leftSection={<IconLogout size={16} />}
                      onClick={() => {
                        signOut();
                        toggle();
                      }}
                      color="red"
                    />
                  </Stack>
                </Stack>
              ) : (
                <Button
                  fullWidth
                  variant="filled"
                  onClick={() => {
                    setAuthView("login");
                    openAuthModal();
                    toggle();
                  }}
                >
                  Giriş Yap
                </Button>
              )}
            </>
          )}
        </Stack>
      </Drawer>

      <AuthModal
        opened={authModalOpened}
        onClose={closeAuthModal}
        defaultView={authView}
      />
    </div>
  );
}
