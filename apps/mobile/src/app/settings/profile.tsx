/**
 * Settings → Profile. Mirrors apps/web/app/(app)/settings/profile/page.tsx:
 * name, phone, email (read-only) + Save; and a Change password section
 * (current / new / confirm). Photo upload is handled on the web (no native
 * image picker bundled) — shown as an intentional read-only avatar.
 */
import { Stack } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { Button, Card, Divider, SectionHeader } from '@/components/ui';
import { useChangePassword, useProfile, useUpdateProfile } from '@/lib/api/profile';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

export default function ProfileSettingsScreen() {
  const { data: me, isLoading } = useProfile();
  const update = useUpdateProfile();
  const changePw = useChangePassword();

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [cur, setCur] = useState('');
  const [nw, setNw] = useState('');
  const [cf, setCf] = useState('');

  useEffect(() => {
    if (me) {
      setName(me.name ?? '');
      setPhone(me.phone ?? '');
    }
  }, [me]);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const saveProfile = () =>
    update.mutate(
      { name, phone },
      { onSuccess: () => showToast('Profile saved'), onError: fail },
    );

  const savePassword = () => {
    if (nw !== cf) {
      showToast('New passwords do not match', 'error');
      return;
    }
    changePw.mutate(
      { currentPassword: cur, newPassword: nw },
      {
        onSuccess: () => {
          showToast('Password changed');
          setCur('');
          setNw('');
          setCf('');
        },
        onError: fail,
      },
    );
  };

  const initial = (name || me?.email || '?').slice(0, 1).toUpperCase();

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Profile')} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Card style={styles.photoCard}>
            {me?.avatarUrl ? (
              <Image source={{ uri: me.avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarInitial}>{initial}</Text>
              </View>
            )}
            <View style={styles.photoText}>
              <Text style={styles.photoTitle}>Photo</Text>
              <Text style={styles.hint}>Upload or change your photo on the web app.</Text>
            </View>
          </Card>

          <SectionHeader title="Your details" />
          <Field label="Name" value={name} onChangeText={setName} />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="+1 555-0100" keyboardType="phone-pad" />
          <Text style={styles.label}>Email</Text>
          <View style={[styles.input, styles.inputDisabled]}>
            <Text style={styles.disabledText}>{me?.email ?? ''}</Text>
          </View>
          <Button label="Save profile" onPress={saveProfile} loading={update.isPending} style={styles.action} />

          <Divider />

          <SectionHeader title="Change password" />
          <Field label="Current password" value={cur} onChangeText={setCur} secureTextEntry />
          <Field label="New password" value={nw} onChangeText={setNw} secureTextEntry />
          <Field label="Confirm new password" value={cf} onChangeText={setCf} secureTextEntry />
          <Button
            label="Change password"
            variant="secondary"
            onPress={savePassword}
            loading={changePw.isPending}
            style={styles.action}
          />
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}
    </>
  );
}

function Field({
  label,
  ...rest
}: { label: string } & React.ComponentProps<typeof TextInput>) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={colors.textSubtle}
        autoCapitalize="none"
        {...rest}
      />
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  photoCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginBottom: space.sm },
  avatar: { width: 56, height: 56, borderRadius: radius.pill },
  avatarFallback: { backgroundColor: colors.primaryTint, alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { fontFamily: fonts.display, fontSize: fontSize.h3, color: colors.primary },
  photoText: { flex: 1, gap: 2 },
  photoTitle: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
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
  inputDisabled: { backgroundColor: colors.surface, justifyContent: 'center', minHeight: 46 },
  disabledText: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.textMuted },
  action: { marginTop: space.md, alignSelf: 'flex-start', paddingHorizontal: space.lg },
});
