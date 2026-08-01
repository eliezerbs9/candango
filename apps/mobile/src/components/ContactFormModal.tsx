/** Create/edit a person or company. Mirrors the web People/Companies modals:
 * name + phone + address + custom fields, plus email & companies (person) or
 * domain & contact-people (company). Both related lists support inline create.
 * Edit mode also offers Delete. */
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
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
import { MultiPickerModal } from '@/components/MultiPickerModal';
import type { PickerOption } from '@/components/PickerModal';
import {
  useCompanies,
  useCreateCompany,
  useCreatePerson,
  useDeleteCompany,
  useDeletePerson,
  usePersons,
  useUpdateCompany,
  useUpdatePerson,
} from '@/lib/api/contacts';
import { useCustomFields } from '@/lib/api/customFields';
import { showToast } from '@/lib/toast';
import type { Address, ApiCompany, ApiPerson, CustomFieldDef } from '@/lib/api/types';
import { colors, fonts, fontSize, radius, space } from '@/theme';

type Kind = 'person' | 'company';

export function ContactFormModal({
  visible,
  kind,
  editing,
  onClose,
}: {
  visible: boolean;
  kind: Kind;
  editing: ApiPerson | ApiCompany | null;
  onClose: () => void;
}) {
  const companies = useCompanies();
  const persons = usePersons();
  const createCompany = useCreateCompany();
  const createPerson = useCreatePerson();
  const updatePerson = useUpdatePerson();
  const updateCompany = useUpdateCompany();
  const deletePerson = useDeletePerson();
  const deleteCompany = useDeleteCompany();
  const customFields = useCustomFields(kind);

  const [name, setName] = useState(''); // company
  const [firstName, setFirstName] = useState(''); // person
  const [lastName, setLastName] = useState(''); // person
  const [email, setEmail] = useState(''); // person
  const [domain, setDomain] = useState(''); // company
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState<Address>({});
  const [relatedIds, setRelatedIds] = useState<string[]>([]);
  const [cf, setCf] = useState<Record<string, string>>({});
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    const p = kind === 'person' ? (editing as ApiPerson | null) : null;
    const c = kind === 'company' ? (editing as ApiCompany | null) : null;
    setName(editing?.name ?? '');
    setFirstName(p?.firstName ?? '');
    setLastName(p?.lastName ?? '');
    setEmail(p?.email ?? '');
    setDomain(c?.domain ?? '');
    setPhone((p?.phone ?? c?.phone) ?? '');
    setAddress((p?.address ?? c?.address) ?? {});
    setRelatedIds(p ? p.companies.map((x) => x.id) : c ? c.contacts.map((x) => x.id) : []);
    const cfInit: Record<string, string> = {};
    for (const [k, v] of Object.entries(editing?.customFields ?? {})) cfInit[k] = v == null ? '' : String(v);
    setCf(cfInit);
    setError(null);
    setPickerOpen(false);
  }, [visible, editing, kind]);

  const relatedOptions: PickerOption[] =
    kind === 'person'
      ? (companies.data ?? []).map((x) => ({ id: x.id, label: x.name, sub: x.domain ?? undefined }))
      : (persons.data ?? []).map((x) => ({ id: x.id, label: x.name, sub: x.email ?? undefined }));
  const relatedLabel =
    relatedIds.length === 0
      ? 'None'
      : relatedOptions
          .filter((o) => relatedIds.includes(o.id))
          .map((o) => o.label)
          .join(', ');

  const saving =
    createPerson.isPending ||
    updatePerson.isPending ||
    createCompany.isPending ||
    updateCompany.isPending;

  // Person requires a first name; company requires a name.
  const canSave = kind === 'person' ? !!firstName.trim() : !!name.trim();

  async function save() {
    if (!canSave) return;
    setError(null);
    const customFieldsOut: Record<string, unknown> = {};
    for (const def of customFields.data ?? []) {
      const raw = cf[def.key];
      if (raw == null || raw === '') continue;
      customFieldsOut[def.key] = def.type === 'number' ? Number(raw) : raw;
    }
    const addr = Object.values(address).some(Boolean) ? address : undefined;
    try {
      if (kind === 'person') {
        const body = {
          firstName: firstName.trim(),
          lastName: lastName.trim() || undefined,
          email: email || undefined,
          phone: phone || undefined,
          address: addr,
          companyIds: relatedIds,
          customFields: customFieldsOut,
        };
        if (editing) await updatePerson.mutateAsync({ id: editing.id, ...body });
        else await createPerson.mutateAsync(body);
      } else {
        const body = {
          name: name.trim(),
          domain: domain || undefined,
          phone: phone || undefined,
          address: addr,
          contactIds: relatedIds,
          customFields: customFieldsOut,
        };
        if (editing) await updateCompany.mutateAsync({ id: editing.id, ...body });
        else await createCompany.mutateAsync(body);
      }
      showToast(`${noun[0].toUpperCase()}${noun.slice(1)} ${editing ? 'saved' : 'created'}`);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  function confirmDelete() {
    if (!editing) return;
    Alert.alert(`Delete “${editing.name}”?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            if (kind === 'person') await deletePerson.mutateAsync(editing.id);
            else await deleteCompany.mutateAsync(editing.id);
            showToast(`${noun[0].toUpperCase()}${noun.slice(1)} deleted`);
            onClose();
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Could not delete.');
          }
        },
      },
    ]);
  }

  const noun = kind === 'person' ? 'person' : 'company';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.title}>{editing ? `Edit ${noun}` : `New ${noun}`}</Text>
            <Pressable onPress={save} hitSlop={10} disabled={saving || !canSave}>
              {saving ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.saveBtn, !canSave && { opacity: 0.4 }]}>Save</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            {kind === 'person' ? (
              <>
                <Text style={styles.label}>First name</Text>
                <TextInput
                  style={styles.input}
                  value={firstName}
                  onChangeText={setFirstName}
                  autoFocus={!editing}
                />
                <Text style={styles.label}>Last name</Text>
                <TextInput style={styles.input} value={lastName} onChangeText={setLastName} />
              </>
            ) : (
              <>
                <Text style={styles.label}>Name</Text>
                <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus={!editing} />
              </>
            )}

            {kind === 'person' ? (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            ) : (
              <>
                <Text style={styles.label}>Domain</Text>
                <TextInput
                  style={styles.input}
                  value={domain}
                  onChangeText={setDomain}
                  placeholder="acme.com"
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Text style={styles.label}>Phone</Text>
            <TextInput style={styles.input} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />

            <Text style={styles.label}>{kind === 'person' ? 'Companies' : 'Contact people'}</Text>
            <Pressable style={styles.field} onPress={() => setPickerOpen(true)}>
              <Text style={styles.fieldValue} numberOfLines={1}>
                {relatedLabel}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </Pressable>

            {(customFields.data ?? []).map((def) => (
              <CustomField
                key={def.id}
                def={def}
                value={cf[def.key] ?? ''}
                onChange={(v) => setCf((prev) => ({ ...prev, [def.key]: v }))}
              />
            ))}

            <View style={styles.divider} />
            <AddressFields label="Address" value={address} onChange={setAddress} withName={false} />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            {editing ? (
              <Pressable style={styles.deleteBtn} onPress={confirmDelete}>
                <Text style={styles.deleteText}>Delete {noun}</Text>
              </Pressable>
            ) : null}
            <View style={{ height: space.md }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <MultiPickerModal
        visible={pickerOpen}
        title={kind === 'person' ? 'Companies' : 'Contact people'}
        options={relatedOptions}
        selectedIds={relatedIds}
        onChange={setRelatedIds}
        onCreate={async (label) =>
          kind === 'person'
            ? (await createCompany.mutateAsync({ name: label })).id
            : (await createPerson.mutateAsync({ name: label })).id
        }
        onClose={() => setPickerOpen(false)}
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
            <Pressable
              key={opt}
              style={[styles.chip, value === opt && styles.chipOn]}
              onPress={() => onChange(value === opt ? '' : opt)}
            >
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 7, backgroundColor: colors.surface },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.bold, color: colors.white },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginTop: space.md },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
  deleteBtn: {
    marginTop: space.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.lg,
    paddingVertical: 13,
    alignItems: 'center',
  },
  deleteText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.danger },
});
