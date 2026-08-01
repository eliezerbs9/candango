/**
 * Settings → API Keys. Mirrors apps/web/app/(app)/settings/api-keys/page.tsx:
 * admin-only; list keys (name, prefix, scopes), create a key (name + scopes)
 * with the secret shown once, and revoke keys. (No native clipboard module is
 * bundled, so the secret is rendered selectable for long-press copy.)
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MultiPickerModal } from '@/components/MultiPickerModal';
import { Icon } from '@/components/Icon';
import { Button, IconButton } from '@/components/ui';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/lib/api/apikeys';
import { useAuthStore } from '@/lib/auth/store';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

const SCOPES = [
  'deals:read',
  'deals:write',
  'deals:delete',
  'persons:read',
  'persons:write',
  'pipelines:manage',
  'reports:read',
  'webhooks:manage',
];

export default function ApiKeysScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';

  const { data: keys = [], isLoading } = useApiKeys(isAdmin);
  const create = useCreateApiKey();
  const revoke = useRevokeApiKey();

  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [scopes, setScopes] = useState<string[]>([]);
  const [scopePicker, setScopePicker] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const openCreate = () => {
    setName('');
    setScopes([]);
    setSecret(null);
    setModalOpen(true);
  };

  const submit = () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    create.mutate({ name: name.trim(), scopes }, { onSuccess: (data) => setSecret(data.secret), onError: fail });
  };

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={settingsHeaderOptions('API Keys')} />
        <View style={styles.center}>
          <Text style={styles.dim}>Only admins can manage API keys.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('API Keys')} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <View style={styles.headRow}>
            <Text style={styles.intro}>Scoped credentials for programmatic access. The secret is shown once.</Text>
            <Button label="Create" icon="add" onPress={openCreate} style={styles.addBtn} />
          </View>

          {keys.length === 0 ? (
            <Text style={styles.dim}>No API keys yet.</Text>
          ) : (
            keys.map((k) => (
              <View key={k.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardText}>
                    <Text style={styles.name}>{k.name}</Text>
                    <Text style={styles.mono}>{k.prefix}…</Text>
                  </View>
                  <IconButton
                    icon="delete"
                    accessibilityLabel={`Revoke ${k.name}`}
                    size={18}
                    color={colors.danger}
                    onPress={() => revoke.mutate(k.id, { onSuccess: () => showToast('Key revoked'), onError: fail })}
                  />
                </View>
                {k.scopes.length ? (
                  <View style={styles.scopeRow}>
                    {k.scopes.map((s) => (
                      <View key={s} style={styles.scopeChip}>
                        <Text style={styles.scopeText}>{s}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.dim}>No scopes</Text>
                )}
              </View>
            ))
          )}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Text style={styles.cancel}>{secret ? 'Done' : 'Cancel'}</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Create API key</Text>
              {secret ? (
                <View style={{ width: 48 }} />
              ) : (
                <Pressable onPress={submit} hitSlop={10} disabled={create.isPending || !name.trim()}>
                  {create.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.save, !name.trim() && { opacity: 0.4 }]}>Create</Text>
                  )}
                </Pressable>
              )}
            </View>

            {secret ? (
              <View style={styles.form}>
                <Text style={styles.secretNote}>
                  Copy this secret now — you won&apos;t be able to see it again. Long-press to copy.
                </Text>
                <Text style={styles.secretBox} selectable>
                  {secret}
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <Text style={styles.formLabel}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={name}
                  onChangeText={setName}
                  placeholder="Billing integration"
                  placeholderTextColor={colors.textSubtle}
                  autoFocus
                />
                <Text style={styles.formLabel}>Scopes</Text>
                <Pressable style={styles.field} onPress={() => setScopePicker(true)}>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {scopes.length ? scopes.join(', ') : 'Pick scopes'}
                  </Text>
                  <Icon name="chevronRight" size={16} color={colors.textMuted} />
                </Pressable>
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>

        <MultiPickerModal
          visible={scopePicker}
          title="Scopes"
          options={SCOPES.map((s) => ({ id: s, label: s }))}
          selectedIds={scopes}
          onChange={setScopes}
          onClose={() => setScopePicker(false)}
        />
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: space.lg },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginBottom: space.xs },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  addBtn: { paddingHorizontal: space.md, minHeight: 40 },
  dim: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  cardText: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  mono: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.textMuted },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scopeChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  scopeText: { fontFamily: fonts.mono, fontSize: fontSize.xs, color: colors.textMuted },
  // modal
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
  sheetHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetTitle: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  cancel: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  save: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.xs + 2 },
  formLabel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.sm + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.lg,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 13,
    backgroundColor: colors.surface,
    gap: space.sm,
  },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink, flex: 1 },
  secretNote: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  secretBox: {
    fontFamily: fonts.mono,
    fontSize: fontSize.sm,
    color: colors.ink,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    marginTop: space.sm,
  },
});
