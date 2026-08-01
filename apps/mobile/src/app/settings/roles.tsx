/**
 * Settings → Roles. Mirrors apps/web/app/(app)/settings/roles/page.tsx:
 * list role cards (name, system/visibility badges, scope badges), create/edit
 * roles (name + record visibility + permission scopes), delete non-system roles.
 */
import { Stack } from 'expo-router';
import { useState } from 'react';
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

import { Icon } from '@/components/Icon';
import { MultiPickerModal } from '@/components/MultiPickerModal';
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { Button, IconButton } from '@/components/ui';
import {
  useCreateRole,
  useDeleteRole,
  useRoles,
  useScopeCatalog,
  useUpdateRole,
  type ApiRole,
} from '@/lib/api/members';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

const VISIBILITY_OPTIONS: PickerOption[] = [
  { id: 'own', label: 'Own', sub: 'only records they own' },
  { id: 'team', label: 'Team', sub: 'their team’s records' },
  { id: 'org', label: 'Organization', sub: 'all records' },
];

type Visibility = ApiRole['visibility'];

export default function RolesScreen() {
  const { data: roles = [], isLoading } = useRoles();
  const { data: catalog = [] } = useScopeCatalog();
  const create = useCreateRole();
  const update = useUpdateRole();
  const del = useDeleteRole();

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ApiRole | null>(null);
  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('own');
  const [scopes, setScopes] = useState<string[]>([]);
  const [visPicker, setVisPicker] = useState(false);
  const [scopePicker, setScopePicker] = useState(false);

  const labelOf = (scope: string) => catalog.find((c) => c.value === scope)?.label ?? scope;
  const scopeOptions: PickerOption[] = catalog.map((c) => ({ id: c.value, label: c.label }));

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Failed', 'error');

  const openCreate = () => {
    setEditing(null);
    setName('');
    setVisibility('own');
    setScopes([]);
    setModalOpen(true);
  };

  const openEdit = (r: ApiRole) => {
    setEditing(r);
    setName(r.name);
    setVisibility(r.visibility);
    setScopes(r.scopes);
    setModalOpen(true);
  };

  const remove = (r: ApiRole) =>
    Alert.alert(`Delete the “${r.name}” role?`, "This can't be undone.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => del.mutate(r.id, { onSuccess: () => showToast('Role deleted'), onError: fail }),
      },
    ]);

  const submit = () => {
    if (!name.trim()) {
      showToast('Name is required', 'error');
      return;
    }
    const body = { name: name.trim(), visibility, scopes };
    const onSuccess = () => {
      showToast(editing ? 'Role updated' : 'Role created');
      setModalOpen(false);
    };
    if (editing) update.mutate({ id: editing.id, ...body }, { onSuccess, onError: fail });
    else create.mutate(body, { onSuccess, onError: fail });
  };

  const visLabel = VISIBILITY_OPTIONS.find((v) => v.id === visibility)?.label ?? visibility;

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Roles')} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Text style={styles.intro}>
              Roles control what members can do and whose records they see. System roles can’t be edited.
            </Text>
            <Button label="New role" icon="add" onPress={openCreate} style={styles.newBtn} />
          </View>

          {roles.map((r) => (
            <View key={r.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.titleRow}>
                  <Text style={styles.roleName}>{r.name}</Text>
                  {r.isSystem ? (
                    <View style={styles.sysBadge}>
                      <Text style={styles.sysText}>system</Text>
                    </View>
                  ) : null}
                </View>
                <View style={styles.titleRow}>
                  <View style={styles.visBadge}>
                    <Text style={styles.visText}>visibility: {r.visibility}</Text>
                  </View>
                  {!r.isSystem ? (
                    <>
                      <IconButton icon="edit" accessibilityLabel={`Edit ${r.name}`} size={18} onPress={() => openEdit(r)} />
                      <IconButton
                        icon="delete"
                        accessibilityLabel={`Delete ${r.name}`}
                        size={18}
                        color={colors.danger}
                        onPress={() => remove(r)}
                      />
                    </>
                  ) : null}
                </View>
              </View>
              <View style={styles.scopeRow}>
                {r.scopes.includes('*') ? (
                  <Chip text="Full access" />
                ) : r.scopes.length ? (
                  r.scopes.map((s) => <Chip key={s} text={labelOf(s)} />)
                ) : (
                  <Text style={styles.dim}>No permissions</Text>
                )}
              </View>
            </View>
          ))}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>{editing ? 'Edit role' : 'New role'}</Text>
              <Pressable onPress={submit} hitSlop={10} disabled={create.isPending || update.isPending || !name.trim()}>
                {create.isPending || update.isPending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Text style={[styles.save, !name.trim() && { opacity: 0.4 }]}>Save</Text>
                )}
              </Pressable>
            </View>
            <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Name</Text>
              <TextInput style={styles.input} value={name} onChangeText={setName} autoFocus={!editing} />

              <Text style={styles.label}>Record visibility</Text>
              <Pressable style={styles.field} onPress={() => setVisPicker(true)}>
                <Text style={styles.fieldValue}>{visLabel}</Text>
                <Icon name="chevronDown" size={16} color={colors.textMuted} />
              </Pressable>

              <Text style={styles.label}>Permissions</Text>
              <Pressable style={styles.field} onPress={() => setScopePicker(true)}>
                <Text style={styles.fieldValue} numberOfLines={2}>
                  {scopes.length ? scopes.map(labelOf).join(', ') : 'None'}
                </Text>
                <Icon name="chevronRight" size={16} color={colors.textMuted} />
              </Pressable>
            </ScrollView>
          </SafeAreaView>
        </KeyboardAvoidingView>

        <PickerModal
          visible={visPicker}
          title="Record visibility"
          options={VISIBILITY_OPTIONS}
          selectedId={visibility}
          onSelect={(id) => {
            if (id) setVisibility(id as Visibility);
            setVisPicker(false);
          }}
          onClose={() => setVisPicker(false)}
        />
        <MultiPickerModal
          visible={scopePicker}
          title="Permissions"
          options={scopeOptions}
          selectedIds={scopes}
          onChange={setScopes}
          onClose={() => setScopePicker(false)}
        />
      </Modal>
    </>
  );
}

function Chip({ text }: { text: string }) {
  return (
    <View style={styles.chip}>
      <Text style={styles.chipText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  head: { gap: space.sm, marginBottom: space.xs },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  newBtn: { alignSelf: 'flex-start', paddingHorizontal: space.md, minHeight: 40 },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  roleName: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  sysBadge: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1, borderColor: colors.border },
  sysText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.textMuted },
  visBadge: { backgroundColor: colors.primaryTint, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  visText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.primary },
  scopeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  dim: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textSubtle },
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
    gap: space.sm,
  },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink, flex: 1 },
});
