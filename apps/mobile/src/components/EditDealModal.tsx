/** Edit a deal's fields — title, value, expected close, company/contact (create
 * inline), custom fields, and Ship-to / Bill-to addresses. Mirrors the web
 * deal Details sidebar. */
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

import { AddressFields } from '@/components/AddressFields';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { useCompanies, useCreateCompany, useCreatePerson, usePersons } from '@/lib/api/contacts';
import { useCustomFields } from '@/lib/api/customFields';
import { useUpdateDeal } from '@/lib/api/deals';
import { useDealEstimates } from '@/lib/api/quickbooks';
import { showToast } from '@/lib/toast';
import type { Address, ApiDeal, CustomFieldDef } from '@/lib/api/types';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type OpenPicker = null | 'company' | 'person';

export function EditDealModal({ visible, deal, onClose }: { visible: boolean; deal: ApiDeal; onClose: () => void }) {
  const companies = useCompanies();
  const persons = usePersons();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();
  const customFields = useCustomFields('deal');
  const estimates = useDealEstimates(deal.id);
  const hasEstimates = (estimates.data ?? []).length > 0;
  const update = useUpdateDeal();

  const [title, setTitle] = useState(deal.title);
  const [valueText, setValueText] = useState(String(deal.value / 100));
  const [companyId, setCompanyId] = useState<string | null>(deal.companyId);
  const [personId, setPersonId] = useState<string | null>(deal.primaryPersonId);
  // A deal already linked for billing: changing the company/contact is allowed but won't move the
  // existing billing account, so we just warn (no hard lock).
  const linked = !!deal.qbSubcustomerId;
  const clientChanged = linked && (companyId !== deal.companyId || personId !== deal.primaryPersonId);
  const [closeDate, setCloseDate] = useState<Date | null>(deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null);
  const [showDate, setShowDate] = useState(false);
  const [shipTo, setShipTo] = useState<Address>(deal.shipTo ?? {});
  const [billTo, setBillTo] = useState<Address>(deal.billTo ?? {});
  const [cf, setCf] = useState<Record<string, string>>({});
  const [picker, setPicker] = useState<OpenPicker>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(deal.title);
    setValueText(String(deal.value / 100));
    setCompanyId(deal.companyId);
    setPersonId(deal.primaryPersonId);
    setCloseDate(deal.expectedCloseDate ? new Date(deal.expectedCloseDate) : null);
    setShowDate(false);
    setShipTo(deal.shipTo ?? {});
    setBillTo(deal.billTo ?? {});
    const cfInit: Record<string, string> = {};
    for (const [k, v] of Object.entries(deal.customFields ?? {})) cfInit[k] = v == null ? '' : String(v);
    setCf(cfInit);
    setError(null);
  }, [visible, deal]);

  const companyOptions: PickerOption[] = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.domain ?? undefined }));
  const personOptions: PickerOption[] = (persons.data ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.email ?? undefined }));
  const companyLabel = companies.data?.find((c) => c.id === companyId)?.name ?? 'None';
  const personLabel = persons.data?.find((p) => p.id === personId)?.name ?? 'None';

  async function save() {
    setError(null);
    const dollars = parseFloat(valueText.replace(/,/g, '.'));
    const customFieldsOut: Record<string, unknown> = {};
    for (const def of customFields.data ?? []) {
      const raw = cf[def.key];
      if (raw == null || raw === '') continue;
      customFieldsOut[def.key] = def.type === 'number' ? Number(raw) : raw;
    }
    try {
      await update.mutateAsync({
        id: deal.id,
        title: title.trim(),
        value: Number.isFinite(dollars) ? Math.round(dollars * 100) : 0,
        companyId,
        primaryPersonId: personId,
        expectedCloseDate: closeDate ? closeDate.toISOString() : null,
        shipTo,
        billTo,
        customFields: customFieldsOut,
      });
      showToast('Deal saved');
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
                <Text style={[styles.saveBtn, !title.trim() && { opacity: 0.4 }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.label}>Title</Text>
            <TextInput style={styles.input} value={title} onChangeText={setTitle} />

            <Text style={styles.label}>Value (USD)</Text>
            <TextInput
              style={[styles.input, hasEstimates && styles.inputLocked]}
              value={valueText}
              onChangeText={setValueText}
              keyboardType="decimal-pad"
              editable={!hasEstimates}
            />
            {hasEstimates ? (
              <Text style={styles.lockHint}>From the estimates below — edit those to change the value.</Text>
            ) : null}

            <Text style={styles.label}>Expected close</Text>
            <View style={styles.dateRow}>
              <Pressable style={[styles.field, { flex: 1 }]} onPress={() => setShowDate((s) => !s)}>
                <Text style={styles.fieldValue}>{closeDate ? formatDate(closeDate.toISOString()) : 'None'}</Text>
              </Pressable>
              {closeDate ? (
                <Pressable style={styles.clear} onPress={() => setCloseDate(null)}>
                  <Text style={styles.clearText}>Clear</Text>
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
            {clientChanged ? (
              <Text style={styles.fieldHint}>
                This deal already has a billing account. Changing the company or contact here won’t update that account — review it under Estimates &amp; invoices.
              </Text>
            ) : null}

            {(customFields.data ?? []).map((def) => (
              <CustomField key={def.id} def={def} value={cf[def.key] ?? ''} onChange={(v) => setCf((p) => ({ ...p, [def.key]: v }))} />
            ))}

            <View style={styles.divider} />
            <AddressFields label="Ship to (work site)" value={shipTo} onChange={setShipTo} />
            <AddressFields label="Bill to (payer)" value={billTo} onChange={setBillTo} />

            {error ? <Text style={styles.error}>{error}</Text> : null}
            <View style={{ height: space.md }} />
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
        onCreate={async (name) => (await createCompany.mutateAsync({ name })).id}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'person'}
        title="Primary contact"
        options={personOptions}
        selectedId={personId}
        allowClear
        onSelect={setPersonId}
        onCreate={async (name) =>
          (await createPerson.mutateAsync({ name, companyIds: companyId ? [companyId] : undefined })).id
        }
        onClose={() => setPicker(null)}
      />
    </Modal>
  );
}

function CustomField({ def, value, onChange }: { def: CustomFieldDef; value: string; onChange: (v: string) => void }) {
  return (
    <>
      <Text style={styles.label}>{def.label}</Text>
      {def.type === 'select' ? (
        <View style={styles.chips}>
          {def.options.map((opt) => (
            <Pressable key={opt} style={[styles.chip, value === opt && styles.chipOn]} onPress={() => onChange(value === opt ? '' : opt)}>
              <Text style={[styles.chipText, value === opt && styles.chipTextOn]}>{opt}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChange}
          keyboardType={def.type === 'number' ? 'decimal-pad' : 'default'}
          placeholder={def.type === 'date' ? 'YYYY-MM-DD' : ''}
          placeholderTextColor={colors.textSubtle}
        />
      )}
    </>
  );
}

function Field({ label, value, onPress, disabled, hint }: { label: string; value: string; onPress: () => void; disabled?: boolean; hint?: string }) {
  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={[styles.field, disabled && styles.fieldDisabled]} onPress={onPress} disabled={disabled}>
        <Text style={[styles.fieldValue, disabled && styles.fieldValueDisabled]} numberOfLines={1}>
          {value}
        </Text>
        {!disabled ? <Text style={styles.chevron}>›</Text> : null}
      </Pressable>
      {disabled && hint ? <Text style={styles.fieldHint}>{hint}</Text> : null}
    </>
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
  saveBtn: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
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
  inputLocked: { backgroundColor: colors.border, color: colors.textMuted },
  lockHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 2 },
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
  fieldDisabled: { backgroundColor: '#f4f4f5', opacity: 0.8 },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink, flexShrink: 1 },
  fieldValueDisabled: { color: colors.textMuted },
  fieldHint: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle, marginTop: 4 },
  chevron: { fontFamily: fonts.regular, fontSize: 22, color: colors.textSubtle },
  clear: { paddingHorizontal: 12, paddingVertical: 13 },
  clearText: { fontFamily: fonts.medium, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.white },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: space.md },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
});
