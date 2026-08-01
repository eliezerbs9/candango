/**
 * Settings hub — a clean list of the sub-sections, mirroring the web
 * Settings nav (apps/web/components/settings/SettingsNav.tsx). Pure router:
 * each row navigates to a sub-screen. Reached from the Profile tab.
 */
import { type Href, Stack, useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon, type IconName } from '@/components/Icon';
import { SectionHeader } from '@/components/ui';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

type Item = { href: Href; icon: IconName; label: string; sub: string };

// Order mirrors the web SettingsNav; grouped for readability on mobile.
const GROUPS: { title: string; items: Item[] }[] = [
  {
    title: 'Account',
    items: [
      { href: '/settings/profile', icon: 'profile', label: 'Profile', sub: 'Your name, phone, photo & password' },
    ],
  },
  {
    title: 'Workspace',
    items: [
      { href: '/settings/general', icon: 'company', label: 'General', sub: 'Workspace name, logo & plan' },
      { href: '/settings/members', icon: 'members', label: 'Members', sub: 'Teammates & invitations' },
      { href: '/settings/roles', icon: 'role', label: 'Roles', sub: 'Permissions & record visibility' },
      { href: '/settings/custom-fields', icon: 'customField', label: 'Custom Fields', sub: 'Fields on deals, people & companies' },
      { href: '/settings/billing', icon: 'billing', label: 'Billing', sub: 'Plan, seats & invoices' },
    ],
  },
  {
    title: 'Developer',
    items: [
      { href: '/settings/api-keys', icon: 'apiKey', label: 'API Keys', sub: 'Scoped programmatic access' },
      { href: '/settings/webhooks', icon: 'webhook', label: 'Webhooks', sub: 'Signed event deliveries' },
      { href: '/settings/integrations', icon: 'integrations', label: 'Integrations', sub: 'Google & QuickBooks' },
    ],
  },
];

export default function SettingsHubScreen() {
  const router = useRouter();
  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Settings')} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        {GROUPS.map((group) => (
          <View key={group.title} style={styles.group}>
            <SectionHeader title={group.title} />
            <View style={styles.card}>
              {group.items.map((item, i) => (
                <Pressable
                  key={item.label}
                  accessibilityRole="button"
                  onPress={() => router.push(item.href)}
                  style={({ pressed }) => [styles.row, i > 0 && styles.rowBorder, pressed && styles.rowPressed]}
                >
                  <View style={styles.rowIcon}>
                    <Icon name={item.icon} size={20} color={colors.primary} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowLabel}>{item.label}</Text>
                    <Text style={styles.rowSub} numberOfLines={1}>
                      {item.sub}
                    </Text>
                  </View>
                  <Icon name="chevronRight" size={18} color={colors.textSubtle} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.lg },
  group: { gap: space.xs },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: 14,
    minHeight: 60,
  },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowPressed: { backgroundColor: colors.surface },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: colors.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
});
