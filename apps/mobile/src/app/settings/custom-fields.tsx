/**
 * Settings → Custom Fields. Mirrors apps/web/app/(app)/settings/custom-fields/page.tsx:
 * admin-only; a segmented switch (Deals/People/Companies), list of fields
 * (label, type, key + options, delete), and an Add-field modal (label, type,
 * and options for select fields).
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

import { Icon } from '@/components/Icon';
import { Button, Chip as SegChip, IconButton } from '@/components/ui';
import { useCreateCustomField, useCustomFields, useDeleteCustomField } from '@/lib/api/customFields';
import { useAuthStore } from '@/lib/auth/store';
import { showToast } from '@/lib/toast';
import type { CustomFieldType } from '@/lib/api/types';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

type Entity = 'deal' | 'person' | 'company';
const ENTITIES: { value: Entity; label: string }[] = [
  { value: 'deal', label: 'Deals' },
  { value: 'person', label: 'People' },
  { value: 'company', label: 'Companies' },
];
const TYPES: CustomFieldType[] = ['text', 'number', 'date', 'select'];

export default function CustomFieldsScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';

  const [entity, setEntity] = useState<Entity>('deal');
  const { data: fields = [], isLoading } = useCustomFields(entity);
  const create = useCreateCustomField();
  const del = useDeleteCustomField();

  const [modalOpen, setModalOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [type, setType] = useState<CustomFieldType>('text');
  const [optionInput, setOptionInput] = useState('');
  const [options, setOptions] = useState<string[]>([]);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const openCreate = () => {
    setLabel('');
    setType('text');
    setOptions([]);
    setOptionInput('');
    setModalOpen(true);
  };

  const addOption = () => {
    const v = optionInput.trim();
    if (v && !options.includes(v)) setOptions((o) => [...o, v]);
    setOptionInput('');
  };

  const submit = () => {
    if (!label.trim()) {
      showToast('Label is required', 'error');
      return;
    }
    create.mutate(
      { entity, label: label.trim(), type, options: type === 'select' ? options : undefined },
      { onSuccess: () => { showToast('Field added'); setModalOpen(false); }, onError: fail },
    );
  };

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={settingsHeaderOptions('Custom Fields')} />
        <View style={styles.center}>
          <Text style={styles.dim}>Only admins can manage custom fields.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Custom Fields')} />
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <View style={styles.segments}>
          {ENTITIES.map((e) => (
            <SegChip key={e.value} label={e.label} on={entity === e.value} onPress={() => setEntity(e.value)} />
          ))}
        </View>

        <View style={styles.headRow}>
          <Text style={styles.intro}>
            Admin-defined fields stored on each {entity}&apos;s record.
          </Text>
          <Button label="Add field" icon="add" onPress={openCreate} style={styles.addBtn} />
        </View>

        {isLoading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : fields.length === 0 ? (
          <Text style={styles.dim}>No custom fields for {entity} yet.</Text>
        ) : (
          <View style={styles.card}>
            {fields.map((f, i) => (
              <View key={f.id} style={[styles.row, i > 0 && styles.rowBorder]}>
                <View style={styles.rowText}>
                  <View style={styles.labelLine}>
                    <Text style={styles.fieldLabel}>{f.label}</Text>
                    <View style={styles.typeBadge}>
                      <Text style={styles.typeText}>{f.type}</Text>
                    </View>
                  </View>
                  <Text style={styles.keyText} numberOfLines={1}>
                    key: {f.key}
                    {f.type === 'select' && f.options.length ? ` · ${f.options.join(', ')}` : ''}
                  </Text>
                </View>
                <IconButton
                  icon="delete"
                  accessibilityLabel={`Delete ${f.label}`}
                  size={18}
                  color={colors.danger}
                  onPress={() => del.mutate(f.id, { onSuccess: () => showToast('Field deleted'), onError: fail })}
                />
              </View>
            ))}
          </View>
        )}
        <View style={{ height: space.xl }} />
      </ScrollView>

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Add {entity} field</Text>
              <Pressable onPress={submit} hitSlop={10} disabled={create.isPending || !label.trim()}>
                {create.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.save, !label.trim() && { opacity: 0.4 }]}>Add</Text>
                )}
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.formLabel}>Label</Text>
              <TextInput style={styles.input} value={label} onChangeText={setLabel} autoFocus />

              <Text style={styles.formLabel}>Type</Text>
              <View style={styles.segments}>
                {TYPES.map((t) => (
                  <SegChip key={t} label={t} on={type === t} onPress={() => setType(t)} />
                ))}
              </View>

              {type === 'select' ? (
                <>
                  <Text style={styles.formLabel}>Options</Text>
                  <View style={styles.optionInputRow}>
                    <TextInput
                      style={[styles.input, styles.optionInput]}
                      value={optionInput}
                      onChangeText={setOptionInput}
                      placeholder="Type an option"
                      placeholderTextColor={colors.textSubtle}
                      onSubmitEditing={addOption}
                      returnKeyType="done"
                    />
                    <Button label="Add" variant="secondary" onPress={addOption} style={styles.optAdd} />
                  </View>
                  <View style={styles.optChips}>
                    {options.map((o) => (
                      <Pressable key={o} style={styles.optChip} onPress={() => setOptions((prev) => prev.filter((x) => x !== o))}>
                        <Text style={styles.optChipText}>{o}</Text>
                        <Icon name="close" size={13} color={colors.textMuted} />
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : null}
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface, padding: space.lg },
  segments: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm, marginTop: space.xs },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  addBtn: { paddingHorizontal: space.md, minHeight: 40 },
  loading: { paddingVertical: space.xl, alignItems: 'center' },
  dim: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  card: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.border, borderRadius: radius.xl, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.md, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  rowText: { flex: 1, gap: 2 },
  labelLine: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  fieldLabel: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  typeBadge: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 1 },
  typeText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.primary },
  keyText: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
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
  optionInputRow: { flexDirection: 'row', gap: space.sm, alignItems: 'center' },
  optionInput: { flex: 1 },
  optAdd: { paddingHorizontal: space.md, minHeight: 46 },
  optChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.xs },
  optChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surface,
  },
  optChipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.ink },
});
