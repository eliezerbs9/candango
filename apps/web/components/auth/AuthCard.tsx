import { Anchor, Center, Paper, Stack, Text, Title } from '@mantine/core';
import Link from 'next/link';

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: { text: string; linkLabel: string; href: string };
}) {
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" w={400} maw="100%">
        <Stack gap="lg">
          <Stack gap={4} align="center">
            <Title order={3} c="indigo.6">
              Candango
            </Title>
            <Text fw={500}>{title}</Text>
            {subtitle ? (
              <Text c="dimmed" size="sm" ta="center">
                {subtitle}
              </Text>
            ) : null}
          </Stack>

          {children}

          {footer ? (
            <Text c="dimmed" size="sm" ta="center">
              {footer.text}{' '}
              <Anchor component={Link} href={footer.href}>
                {footer.linkLabel}
              </Anchor>
            </Text>
          ) : null}
        </Stack>
      </Paper>
    </Center>
  );
}
