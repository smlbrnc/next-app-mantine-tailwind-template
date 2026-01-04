"use client";

import { HeaderMenu } from "@/components/header-menu";
import { Footer } from "@/components/footer";
import {
  AppShell,
  AppShellMain,
  Container,
  Title,
  Stack,
} from "@mantine/core";

export default function TradePage() {
  return (
    <AppShell header={{ height: 110 }} padding={0}>
      <HeaderMenu />
      <AppShellMain className="pt-4">
        <Container size="xl">
          <Stack gap="xl">
            <Title order={1}>Trade</Title>
          </Stack>
        </Container>
        <Footer />
      </AppShellMain>
    </AppShell>
  );
}
