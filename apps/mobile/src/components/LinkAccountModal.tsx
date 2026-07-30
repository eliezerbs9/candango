/** Link a deal to a QuickBooks customer (mirrors the web LinkAccountModal). */
import { useEffect, useState } from 'react';
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

import { useLinkQuickbooks, useQbLinkStatus, useSearchQbParents } from '@/lib/api/quickbooks';
import type { QbCustomer } from '@/lib/api/types';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type Mode = 'client' | 'existing';

export function LinkAccountModal({
  visible,
  dealId,
  dealTitle,
  onClose,
}: {
  visible: boolean;
  dealId: string;
  dealTitle: string;
  onClose: () => void;
}) {
  const status = useQbLinkStatus(dealId, visible);
  const search = useSearchQbParents(dealId);
  const link = useLinkQuickbooks(dealId);

  const [mode, setMode] = useState<Mode>('client');
  const [q, setQ] = useState('');
  const [results, setResults] = useState<QbCustomer[]>([]);
  const [parentId, setParentId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setMode('client');
    setQ('');
    setResults([]);
    setParentId(null);
    setError(null);
  }, [visible]);

  async function runSearch() {
    setError(null);
    try {
      const r = await search.mutateAsync(q.trim());
      setResults(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Search failed.');
    }
  }

  async function submit() {
    setError(null);
    if (mode === 'existing' && !parentId) {
      setError('Pick a parent customer first.');
      return;
    }
    try {
      await link.mutateAsync(mode === 'existing' ? { parentCustomerId: parentId! } : { createParent: true });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not link the deal.');
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>Set up billing</Text>
            <Pressable onPress={submit} hitSlop={10} disabled={link.isPending}>
              {link.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.link}>Link</Text>}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.note}>
              The deal becomes a sub-account named “{dealTitle}” in QuickBooks, billed under a parent customer.
            </Text>

            <Option
              label="Use the deal's company / contact as the parent"
              on={mode === 'client'}
              onPress={() => setMode('client')}
            />
            <Option
              label="Nest under an existing QuickBooks customer"
              on={mode === 'existing'}
              onPress={() => setMode('existing')}
            />

            {mode === 'existing' ? (
              <View style={styles.searchBox}>
                <View style={styles.searchRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="Customer name"
                    placeholderTextColor={colors.textSubtle}
                    value={q}
                    onChangeText={setQ}
                    onSubmitEditing={runSearch}
                  />
                  <Pressable style={styles.searchBtn} onPress={runSearch} disabled={search.isPending}>
                    {search.isPending ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.searchBtnText}>Search</Text>}
                  </Pressable>
                </View>
                {results.map((c) => (
                  <Pressable
                    key={c.id}
                    style={[styles.result, parentId === c.id && styles.resultOn]}
                    onPress={() => setParentId(c.id)}
                  >
                    <Text style={styles.resultText}>{c.name}</Text>
                    {parentId === c.id ? <Text style={styles.check}>✓</Text> : null}
                  </Pressable>
                ))}
                {results.length === 0 && !search.isPending ? <Text style={styles.hint}>Search to find a customer.</Text> : null}
              </View>
            ) : null}

            {status.data?.clientHasParent ? (
              <Text style={styles.hint}>Existing parent: {status.data.clientName ?? '—'}</Text>
            ) : null}

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function Option({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable style={styles.option} onPress={onPress}>
      <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
      <Text style={styles.optionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '90%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    paddingBottom: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  cancel: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  link: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.sm },
  note: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: space.sm },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  radioOn: { borderColor: colors.primary },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.primary },
  optionText: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.ink, flex: 1 },
  searchBox: { gap: space.sm, marginTop: space.xs },
  searchRow: { flexDirection: 'row', gap: space.sm },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  searchBtn: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center' },
  searchBtnText: { fontFamily: fonts.semibold, color: colors.primary },
  result: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: colors.surface,
  },
  resultOn: { borderColor: colors.primary, backgroundColor: colors.primaryTint },
  resultText: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.ink },
  check: { fontFamily: fonts.bold, color: colors.primary },
  hint: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSubtle },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm },
});
