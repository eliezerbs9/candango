/**
 * Settings → General (workspace/organization). Mirrors
 * apps/web/app/(app)/settings/general/page.tsx: workspace name (admin-editable),
 * plan badge, workspace ID + Save, and logo upload (camera/library, resized like
 * the web) for admins.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Icon } from '@/components/Icon';
import { Button, Card } from '@/components/ui';
import { useOrganization, useUpdateOrganization } from '@/lib/api/organization';
import { useAuthStore } from '@/lib/auth/store';
import { choosePhotoSource, pickPhotoDataUrl } from '@/lib/image';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

export default function GeneralSettingsScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';
  const { data: org, isLoading } = useOrganization();
  const update = useUpdateOrganization();

  const [name, setName] = useState('');
  const [logoError, setLogoError] = useState(false);
  const [logoBusy, setLogoBusy] = useState(false);

  useEffect(() => {
    if (org) {
      setName(org.name);
      setLogoError(false);
    }
  }, [org]);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const save = () =>
    update.mutate({ name }, { onSuccess: () => showToast('Workspace updated'), onError: fail });

  const setLogo = (logoUrl: string) => {
    setLogoError(false);
    update.mutate(
      { logoUrl },
      { onSuccess: () => showToast(logoUrl ? 'Logo updated' : 'Logo removed'), onError: fail },
    );
  };

  const onPickLogo = () =>
    choosePhotoSource(
      async (source) => {
        setLogoBusy(true);
        try {
          const dataUrl = await pickPhotoDataUrl('logo', source);
          if (dataUrl) setLogo(dataUrl);
        } catch (e) {
          fail(e);
        } finally {
          setLogoBusy(false);
        }
      },
      org?.logoUrl ? { onRemove: () => setLogo('') } : undefined,
    );

  const hasLogo = !!org?.logoUrl && !logoError;

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('General')} />
      {isLoading || !org ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            Your workspace (organization) — name and logo. Distinct from CRM companies you sell to.
          </Text>

          <Card style={styles.logoCard}>
            <Pressable
              onPress={onPickLogo}
              disabled={!isAdmin || logoBusy}
              accessibilityRole="button"
              accessibilityLabel="Change workspace logo"
            >
              <View>
                {hasLogo ? (
                  <Image
                    source={{ uri: org.logoUrl! }}
                    style={styles.logo}
                    resizeMode="contain"
                    onError={() => setLogoError(true)}
                  />
                ) : (
                  <View style={[styles.logo, styles.logoFallback]}>
                    <Text style={styles.logoInitial}>{org.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                )}
                {isAdmin ? (
                  <View style={styles.logoBadge}>
                    {logoBusy ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Icon name="add" size={14} color={colors.white} />
                    )}
                  </View>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.logoText}>
              <Text style={styles.logoTitle}>Workspace logo</Text>
              <Text style={styles.hint}>
                {isAdmin ? 'Tap to take a photo or choose from your library.' : 'Only admins can change the logo.'}
              </Text>
            </View>
          </Card>

          <Text style={styles.label}>Workspace name</Text>
          <TextInput
            style={[styles.input, !isAdmin && styles.inputDisabled]}
            value={name}
            onChangeText={setName}
            editable={isAdmin}
          />

          <View style={styles.meta}>
            <View>
              <Text style={styles.metaLabel}>Plan</Text>
              <View style={styles.planBadge}>
                <Text style={styles.planText}>{org.plan}</Text>
              </View>
            </View>
            <View style={styles.metaId}>
              <Text style={styles.metaLabel}>Workspace ID</Text>
              <Text style={styles.mono} numberOfLines={1}>
                {org.id}
              </Text>
            </View>
          </View>

          {isAdmin ? (
            <Button label="Save changes" onPress={save} loading={update.isPending} style={styles.action} />
          ) : (
            <Text style={styles.hint}>Only admins can change workspace settings.</Text>
          )}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginBottom: space.sm },
  logoCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  logo: { width: 56, height: 56, borderRadius: radius.md },
  logoFallback: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  logoInitial: { fontFamily: fonts.display, fontSize: fontSize.h3, color: colors.primary },
  logoBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.bg,
  },
  logoText: { flex: 1, gap: 2 },
  logoTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.xs },
  label: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.sm + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  inputDisabled: { backgroundColor: colors.surface, color: colors.textMuted },
  meta: { flexDirection: 'row', gap: space.xl, marginTop: space.md },
  metaId: { flex: 1 },
  metaLabel: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle, marginBottom: 4 },
  planBadge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  planText: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.primary, textTransform: 'capitalize' },
  mono: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.ink },
  action: { marginTop: space.md, alignSelf: 'flex-start', paddingHorizontal: space.lg },
});
