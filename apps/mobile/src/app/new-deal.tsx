/**
 * Create a deal. Title + value + stage (from the default pipeline) + optional
 * company/contact. Presented as a modal from the Deals tab.
 */
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { useCompanies, useCreateCompany, useCreatePerson, usePersons } from '@/lib/api/contacts';
import { useCreateDeal, usePipelines, useStages } from '@/lib/api/deals';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type OpenPicker = null | 'stage' | 'company' | 'person';

export default function NewDealScreen() {
  const router = useRouter();
  const pipelines = usePipelines();
  const stages = useStages();
  const companies = useCompanies();
  const persons = usePersons();
  const create = useCreateDeal();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();

  const [title, setTitle] = useState('');
  const [valueText, setValueText] = useState('');
  const [stageId, setStageId] = useState<string | null>(null);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [picker, setPicker] = useState<OpenPicker>(null);
  const [error, setError] = useState<string | null>(null);

  const pipelineId = useMemo(() => {
    const list = pipelines.data ?? [];
    return list.find((p) => p.isDefault)?.id ?? list[0]?.id ?? null;
  }, [pipelines.data]);

  const pipelineStages = useMemo(
    () =>
      (stages.data ?? [])
        .filter((s) => s.pipelineId === pipelineId)
        .sort((a, b) => a.position - b.position),
    [stages.data, pipelineId],
  );

  // Default to the first stage of the pipeline once stages load.
  useEffect(() => {
    if (!stageId && pipelineStages.length > 0) setStageId(pipelineStages[0].id);
  }, [pipelineStages, stageId]);

  const stageOptions: PickerOption[] = pipelineStages.map((s) => ({ id: s.id, label: s.name }));
  const companyOptions: PickerOption[] = (companies.data ?? []).map((c) => ({ id: c.id, label: c.name, sub: c.domain ?? undefined }));
  const personOptions: PickerOption[] = (persons.data ?? []).map((p) => ({ id: p.id, label: p.name, sub: p.email ?? undefined }));

  const stageLabel = pipelineStages.find((s) => s.id === stageId)?.name ?? 'Select…';
  const companyLabel = companies.data?.find((c) => c.id === companyId)?.name ?? 'None';
  const personLabel = persons.data?.find((p) => p.id === personId)?.name ?? 'None';

  const canSubmit = title.trim().length > 0 && !!pipelineId && !!stageId && !create.isPending;

  async function submit() {
    if (!pipelineId || !stageId) return;
    setError(null);
    const dollars = parseFloat(valueText.replace(/,/g, '.'));
    const valueCents = Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
    try {
      const deal = await create.mutateAsync({
        title: title.trim(),
        value: valueCents,
        currency: 'USD',
        pipelineId,
        stageId,
        companyId: companyId ?? undefined,
        primaryPersonId: personId ?? undefined,
      });
      router.replace(`/deal/${deal.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not create the deal.');
    }
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Website redesign"
          placeholderTextColor={colors.textSubtle}
          autoFocus
        />

        <Text style={styles.label}>Value (USD)</Text>
        <TextInput
          style={styles.input}
          value={valueText}
          onChangeText={setValueText}
          placeholder="0.00"
          placeholderTextColor={colors.textSubtle}
          keyboardType="decimal-pad"
        />

        <Field label="Stage" value={stageLabel} onPress={() => setPicker('stage')} />
        <Field label="Company" value={companyLabel} onPress={() => setPicker('company')} />
        <Field label="Primary contact" value={personLabel} onPress={() => setPicker('person')} />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={[styles.submit, !canSubmit && styles.submitOff]} disabled={!canSubmit} onPress={submit}>
          {create.isPending ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.submitText}>Create deal</Text>
          )}
        </Pressable>
      </ScrollView>

      <PickerModal
        visible={picker === 'stage'}
        title="Stage"
        options={stageOptions}
        selectedId={stageId}
        onSelect={(id) => setStageId(id)}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'company'}
        title="Company"
        options={companyOptions}
        selectedId={companyId}
        allowClear
        onSelect={(id) => setCompanyId(id)}
        onCreate={async (name) => {
          const c = await createCompany.mutateAsync({ name });
          return c.id;
        }}
        onClose={() => setPicker(null)}
      />
      <PickerModal
        visible={picker === 'person'}
        title="Primary contact"
        options={personOptions}
        selectedId={personId}
        allowClear
        onSelect={(id) => setPersonId(id)}
        onCreate={async (name) => {
          const p = await createPerson.mutateAsync({
            name,
            companyIds: companyId ? [companyId] : undefined,
          });
          return p.id;
        }}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
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
  flex: { flex: 1, backgroundColor: colors.bg },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: space.lg, gap: space.xs + 2 },
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
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
  submit: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: space.lg,
  },
  submitOff: { opacity: 0.5 },
  submitText: { fontFamily: fonts.bold, color: colors.white, fontSize: fontSize.lg },
});
