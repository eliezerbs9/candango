import { Center, Paper, Stack, Text, Title } from '@mantine/core';

export default function LoginPage() {
  return (
    <Center mih="100vh" p="md">
      <Paper withBorder shadow="sm" p="xl" radius="md" w={360} maw="100%">
        <Stack gap="xs" align="center">
          <Title order={3} c="indigo.6">
            Candango
          </Title>
          <Text c="dimmed" size="sm" ta="center">
            Sign in (UI-1 — coming soon)
          </Text>
        </Stack>
      </Paper>
    </Center>
  );
}
