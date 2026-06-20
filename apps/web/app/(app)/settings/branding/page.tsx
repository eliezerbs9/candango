'use client';

import { useState } from 'react';
import { Avatar, Button, ColorInput, FileButton, Group, Paper, Stack, Text } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { IconUpload } from '@tabler/icons-react';

export default function BrandingPage() {
  const [color, setColor] = useState('#4263EB');
  const [logo, setLogo] = useState<string | null>(null);

  const onPick = (file: File | null) => {
    if (!file) return;
    setLogo(URL.createObjectURL(file));
    notifications.show({ message: 'Logo selected (upload wires to a pre-signed URL later)' });
  };

  return (
    <Stack maw={520}>
      <Text c="dimmed" size="sm">
        Personalize your workspace. Changes preview here before saving.
      </Text>

      <Paper withBorder radius="md" p="md">
        <Group justify="space-between">
          <Group>
            <Avatar src={logo} radius="md" size="lg" color="indigo">
              C
            </Avatar>
            <div>
              <Text fw={500}>Logo</Text>
              <Text size="xs" c="dimmed">
                PNG, JPG, SVG or WebP · max 2 MB
              </Text>
            </div>
          </Group>
          <FileButton onChange={onPick} accept="image/png,image/jpeg,image/svg+xml,image/webp">
            {(props) => (
              <Button {...props} variant="default" leftSection={<IconUpload size={16} />}>
                Upload
              </Button>
            )}
          </FileButton>
        </Group>
      </Paper>

      <ColorInput label="Primary brand color" value={color} onChange={setColor} />

      <Group>
        <Button
          style={{ backgroundColor: color }}
          onClick={() => notifications.show({ message: 'Branding saved', color: 'green' })}
        >
          Save branding
        </Button>
      </Group>
    </Stack>
  );
}
