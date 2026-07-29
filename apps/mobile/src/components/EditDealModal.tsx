/** Edit a deal's core fields (title, value, expected close, company, contact). */
import DateTimePicker from '@react-native-community/datetimepicker';
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

import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { useCompanies, usePersons } from '@/lib/api/contacts';
import { useUpdateDeal } from '@/lib/api/deals';
import type { ApiDeal } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type OpenPicker = null | 'company' | 'person';

export function EditDealModal({ visible, deal, onClose }: { visible: boolean; deal: ApiDeal; onClose: () => void }) {
  const companies = useCompanies();
  const persons = usePersons();
  const update = useUpdateDeal();

  const [title, setTitle] = useState(deal.title);
  const [valueText, setValueText] = useState(String(deal.value / 100));
  const [companyId, setCompanyId] = useState<string | null>(deal.companyId);
  const [personId, setPersonId] = useState<string | null>(deal.primaryPersonId);
  const [closeDate, setCloseDate] = useState<Date | null>(deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null);
  const [showDate, setShowDate] = useState(false);
  const [picker, setPicker] = useState<OpenPicker>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset the form to the deal's values whenever it (re)opens.
  useEffect(() => {
    if (!visible) return;
    setTitle(deal.title);
    setValueText(String(deal.value / 100));
    setCompanyId(deal.companyId);
    setPersonId(deal.primaryPersonId);
    setCloseDate(deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null);
    setShowDate(false);
    setError(null);
  }, [visible, deal]);

  const companyOptions: PickerOption[] = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.domain ?? undefined }));
  const personOptions: PickerOption[] = (persons.data ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.email ?? undefined }));
  const companyLabel = companies.data?.find((c) => c.id === companyId)?.name ?? 'None';
  const personLabel = persons.data?.find((p) => p.id === personId)?.name ?? 'None';

  async function save() {
    setError(null);
    const dollars = parseFloat(valueText.replace(/,/g, '.'));
    try {
      await update.mutateAsync({
        id: deal.id,
        title: title.trim(),
        value: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
        companyId: companyId,
        primaryPersonId: personId,
        expectedCloseDate: closeDate ? closeDate.toISOString() : null,
      });
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the deal.');
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
            <Text style={styles.title}>Edit deal</Text>
            <Pressable onPress={save} hitSlop={10} disabled={update.isPending || !title.trim()}>
              {update.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.save, !title.trim() && { opacity: 0.4 }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Value (USD)</Text>
            <TextInput style={styles.input} value={valueText} onChangeText={setValueText} keyboardType="decimal-pad" />

            <Text style={styles.label}>Expected close</Text>
            <View style={styles.dateRow}>
              <Pressable style={[styles.field, { flex: 1 }]} onPress={() => setShowDate((s) => !s)}>
                <Text style={styles.fieldValue}>{closeDate ? formatDate(closeDate.toISOString()) : 'None'}</Text>
              </Pressable>
              {closeDate ? (
                <Pressable style={styles.clearDate} onPress={() => setCloseDate(null)}>
                  <Text style={styles.clearDateText}>Clear</Text>
                </Pressable>
              ) : null}
            </View>
            {showDate ? (
              <DateTimePicker
                value={closeDate ?? new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                onChange={(_e, d) => {
                  if (Platform.OS !== 'ios') setShowDate(false);
                  if (d) setCloseDate(d);
                }}
              />
            ) : null}

            <Field label="Company" value={companyLabel} onPress={() => setPicker('company')} />
            <Field label="Primary contact" value={personLabel} onPress={() => setPicker('person')} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={picker === 'company'}
        title="Company"
        options={companyOptions}
        selectedId={companyId}
        allowClear
        onSelect={setCompanyId}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'person'}
        title="Primary contact"
        options={personOptions}
        selectedId={personId}
        allowClear
        onSelect={setPersonId}
        onClose={() => setPicker(null)}
      />
    </Modal>
  );
}

function Field({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.field} onPress={onPress}>
        <Text style={styles.fieldValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </Pressable>
    </>
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
  save: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.xs + 2 },
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
    backgroundColor: colors.surface,
  },
  dateRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
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
  },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink, flexShrink: 1 },
  chevron: { fontFamily: fonts.regular, fontSize: 22, color: colors.textSubtle },
  clearDate: { paddingHorizontal: 12, paddingVertical: 13 },
  clearDateText: { fontFamily: fonts.medium, color: colors.textMuted },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
});
