"use client";

import { IconBrandInstagram, IconBrandTwitter, IconBrandYoutube, IconBrandGithub } from "@tabler/icons-react";
import { ActionIcon, Anchor, Group } from "@mantine/core";
import Link from "next/link";
import { Logo } from "./logo";

const links = [
  { link: "/", label: "Ana Sayfa" },
  { link: "/portfolio", label: "Portföy" },
  { link: "/analiz", label: "Analiz" },
  { link: "/market", label: "Market" },
  { link: "/about", label: "Hakkında" },
];

export function Footer() {
  const items = links.map((link) => (
    <Anchor
      component={Link}
      c="dimmed"
      key={link.label}
      href={link.link}
      lh={1}
      size="sm"
      className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
    >
      {link.label}
    </Anchor>
  ));

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 py-6 mt-auto w-full">
      <div className="w-full max-w-7xl mx-auto px-4">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <Logo size={24} showText={false} />

          <Group gap="md" className="flex-wrap justify-center">{items}</Group>

          <Group gap="xs" justify="flex-end" wrap="nowrap">
            <ActionIcon
              size="lg"
              variant="default"
              radius="xl"
              component="a"
              href="https://twitter.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandTwitter size={18} stroke={1.5} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant="default"
              radius="xl"
              component="a"
              href="https://youtube.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandYoutube size={18} stroke={1.5} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant="default"
              radius="xl"
              component="a"
              href="https://instagram.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandInstagram size={18} stroke={1.5} />
            </ActionIcon>
            <ActionIcon
              size="lg"
              variant="default"
              radius="xl"
              component="a"
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              <IconBrandGithub size={18} stroke={1.5} />
            </ActionIcon>
          </Group>
        </div>
        <div className="text-center mt-4">
          <Anchor
            c="dimmed"
            size="xs"
            href="https://mantine.dev"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-gray-900 dark:hover:text-gray-100 transition-colors"
          >
            Mantine ile geliştirilmiştir
          </Anchor>
        </div>
      </div>
    </footer>
  );
}
