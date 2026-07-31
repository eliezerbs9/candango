/** Line-item editor for an estimate/invoice (mirrors the web DocEditorModal). */
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

import type { CreateDocInput, DealDoc } from '@/lib/api/types';
import { formatMoney } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type Line = { description: string; qty: string; price: string };

const emptyLine = (): Line => ({ description: '', qty: '1', price: '' });

export function DocEditorModal({
  visible,
  title,
  submitLabel,
  currency,
  initial,
  loading,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  title: string;
  submitLabel: string;
  currency: string;
  initial?: DealDoc | null;
  loading: boolean;
  onClose: () => void;
  onSubmit: (input: CreateDocInput) => Promise<unknown>;
}) {
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [notes, setNotes] = useState('');
  const [valueChoice, setValueChoice] = useState<'set' | 'add' | 'none'>('set'); // create only
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setValueChoice('set');
    if (initial && initial.lines.length > 0) {
      setLines(
        initial.lines.map((l) => ({ description: l.description, qty: String(l.quantity), price: String(l.unitPrice / 100) })),
      );
    } else {
      setLines([emptyLine()]);
    }
    setNotes(initial?.notes ?? '');
    setError(null);
  }, [visible, initial]);

  const parsed = lines.map((l) => {
    const qty = parseFloat(l.qty.replace(/,/g, '.')) || 0;
    const price = parseFloat(l.price.replace(/,/g, '.')) || 0;
    return { description: l.description.trim(), qty, priceCents: Math.round(price * 100) };
  });
  const total = parsed.reduce((sum, l) => sum + l.qty * l.priceCents, 0);
  const canSave = parsed.some((l) => l.description && l.priceCents > 0) && !loading;

  function setLine(i: number, patch: Partial<Line>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  async function save() {
    setError(null);
    const validLines = parsed.filter((l) => l.description && l.priceCents > 0);
    if (validLines.length === 0) return;
    // New estimate: how it counts toward the deal value (not on edit).
    const valueFlags = initial
      ? {}
      : valueChoice === 'set'
        ? { setAsValue: true }
        : valueChoice === 'add'
          ? { includeInValue: true }
          : {};
    try {
      await onSubmit({
        notes: notes.trim() || undefined,
        lines: validLines.map((l) => ({ description: l.description, quantity: l.qty || 1, unitPrice: l.priceCents })),
        ...valueFlags,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
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
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={save} hitSlop={10} disabled={!canSave}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.save, !canSave && { opacity: 0.4 }]}>{submitLabel}</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            {lines.map((l, i) => {
              const p = parsed[i];
              return (
                <View key={i} style={styles.lineCard}>
                  <View style={styles.lineTop}>
                    <Text style={styles.lineLabel}>Item {i + 1}</Text>
                    {lines.length > 1 ? (
                      <Pressable onPress={() => setLines((prev) => prev.filter((_, idx) => idx !== i))} hitSlop={8}>
                        <Text style={styles.remove}>Remove</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <TextInput
                    style={styles.input}
                    value={l.description}
                    onChangeText={(t) => setLine(i, { description: t })}
                    placeholder="Description"
                    placeholderTextColor={colors.textSubtle}
                  />
                  <View style={styles.qtyRow}>
                    <View style={styles.qtyCol}>
                      <Text style={styles.smallLabel}>Qty</Text>
                      <TextInput style={styles.input} value={l.qty} onChangeText={(t) => setLine(i, { qty: t })} keyboardType="decimal-pad" />
                    </View>
                    <View style={styles.qtyCol}>
                      <Text style={styles.smallLabel}>Unit price</Text>
                      <TextInput style={styles.input} value={l.price} onChangeText={(t) => setLine(i, { price: t })} keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor={colors.textSubtle} />
                    </View>
                    <View style={styles.amountCol}>
                      <Text style={styles.smallLabel}>Amount</Text>
                      <Text style={styles.amount}>{formatMoney(p.qty * p.priceCents, currency)}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            <Pressable style={styles.addLine} onPress={() => setLines((prev) => [...prev, emptyLine()])}>
              <Text style={styles.addLineText}>＋ Add item</Text>
            </Pressable>

            <Text style={styles.smallLabel}>Notes</Text>
            <TextInput style={[styles.input, styles.notes]} value={notes} onChangeText={setNotes} placeholder="Optional memo" placeholderTextColor={colors.textSubtle} multiline />

            {!initial ? (
              <>
                <Text style={styles.smallLabel}>Deal value</Text>
                <View style={styles.choiceRow}>
                  {([
                    ['set', 'Set as value'],
                    ['add', 'Add to value'],
                    ['none', "Don't count"],
                  ] as const).map(([key, label]) => (
                    <Pressable
                      key={key}
                      style={[styles.choiceChip, valueChoice === key && styles.choiceChipOn]}
                      onPress={() => setValueChoice(key)}
                    >
                      <Text style={[styles.choiceText, valueChoice === key && styles.choiceTextOn]}>{label}</Text>
                    </Pressable>
                  ))}
                </View>
                <Text style={styles.choiceHint}>
                  {valueChoice === 'set'
                    ? "This estimate becomes the deal's value (unmarks the others)."
                    : valueChoice === 'add'
                      ? 'Added to the deal value (summed with the estimates already counted).'
                      : "Won't affect the deal value."}
                </Text>
              </>
            ) : null}

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Total</Text>
              <Text style={styles.totalValue}>{formatMoney(total, currency)}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: colors.bg, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '92%' },
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
  save: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.sm },
  lineCard: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: space.md, gap: space.sm, backgroundColor: colors.surface },
  lineTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lineLabel: { fontFamily: fonts.semibold, fontSize: fontSize.sm, color: colors.textMuted },
  remove: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.danger },
  smallLabel: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.bg,
  },
  qtyRow: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  qtyCol: { flex: 1, gap: 3 },
  amountCol: { flex: 1, gap: 3, alignItems: 'flex-end' },
  amount: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.ink, paddingVertical: 10 },
  addLine: { paddingVertical: 10, alignItems: 'center' },
  addLineText: { fontFamily: fonts.semibold, color: colors.primary, fontSize: fontSize.md },
  notes: { minHeight: 60 },
  choiceRow: { flexDirection: 'row', gap: space.sm },
  choiceChip: { flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, alignItems: 'center', backgroundColor: colors.surface },
  choiceChipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  choiceText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textMuted },
  choiceTextOn: { fontFamily: fonts.bold, color: colors.white },
  choiceHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: space.sm, paddingTop: space.sm, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  totalLabel: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  totalValue: { fontFamily: fonts.bold, fontSize: fontSize.lg, color: colors.success },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm },
});
