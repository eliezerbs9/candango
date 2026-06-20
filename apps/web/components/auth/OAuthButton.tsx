'use client';

import { Button } from '@mantine/core';
import { IconBrandGoogle } from '@tabler/icons-react';

export function OAuthButton({ onClick }: { onClick?: () => void }) {
  return (
    <Button
      variant="default"
      fullWidth
      leftSection={<IconBrandGoogle size={18} />}
      onClick={onClick}
    >
      Continue with Google
    </Button>
  );
}
