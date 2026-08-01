/**
 * Settings → Members. Mirrors apps/web/app/(app)/settings/members/page.tsx:
 * list of members (name, email, role, status), admins can change a member's
 * role, deactivate members, and invite teammates (+1 seat).
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
import { PickerModal, type PickerOption } from '@/components/PickerModal';
import { Button, IconButton } from '@/components/ui';
import { useDeactivateUser, useInviteUser, useRoles, useUpdateUser, useUsers, type ApiMember } from '@/lib/api/members';
import { useAuthStore } from '@/lib/auth/store';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  active: { bg: colors.successTint, fg: colors.success },
  invited: { bg: colors.primaryTint, fg: colors.primary },
  deactivated: { bg: colors.surface, fg: colors.textMuted },
};

export default function MembersScreen() {
  const meId = useAuthStore((s) => s.user?.id);
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';

  const { data: members = [], isLoading } = useUsers();
  const { data: roles = [] } = useRoles();
  const invite = useInviteUser();
  const update = useUpdateUser();
  const deactivate = useDeactivateUser();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [rolePickerFor, setRolePickerFor] = useState<string | null>(null);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const roleOptions: PickerOption[] = roles.map((r) => ({ id: r.id, label: r.name }));

  const confirmDeactivate = (m: ApiMember) =>
    Alert.alert(`Deactivate ${m.name ?? m.email}?`, 'They will lose access to the workspace.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Deactivate',
        style: 'destructive',
        onPress: () =>
          deactivate.mutate(m.id, { onSuccess: () => showToast('Member deactivated'), onError: fail }),
      },
    ]);

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Members')} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <View style={styles.head}>
            <Text style={styles.intro}>
              {members.length} member{members.length === 1 ? '' : 's'} · each active user is a billable seat
            </Text>
            {isAdmin ? (
              <Button label="Invite" icon="add" onPress={() => setInviteOpen(true)} style={styles.inviteBtn} />
            ) : null}
          </View>

          {members.map((m) => {
            const tone = STATUS_TONE[m.status] ?? STATUS_TONE.deactivated;
            const canDeactivate = isAdmin && m.id !== meId && m.status !== 'deactivated';
            return (
              <View key={m.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.cardName}>
                    <Text style={styles.name}>{m.name ?? m.email}</Text>
                    {m.name ? <Text style={styles.email}>{m.email}</Text> : null}
                  </View>
                  <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.badgeText, { color: tone.fg }]}>{m.status}</Text>
                  </View>
                </View>
                <View style={styles.cardBottom}>
                  {isAdmin ? (
                    <Pressable style={styles.rolePick} onPress={() => setRolePickerFor(m.id)}>
                      <Text style={styles.roleValue}>{m.role || 'No role'}</Text>
                      <Icon name="chevronDown" size={14} color={colors.textMuted} />
                    </Pressable>
                  ) : (
                    <Text style={styles.roleStatic}>{m.role}</Text>
                  )}
                  {canDeactivate ? (
                    <IconButton
                      icon="delete"
                      accessibilityLabel={`Deactivate ${m.name ?? m.email}`}
                      color={colors.danger}
                      size={18}
                      onPress={() => confirmDeactivate(m)}
                    />
                  ) : null}
                </View>

                <PickerModal
                  visible={rolePickerFor === m.id}
                  title="Assign role"
                  options={roleOptions}
                  selectedId={m.roleId}
                  onSelect={(id) => {
                    setRolePickerFor(null);
                    if (id && id !== m.roleId) update.mutate({ id: m.id, roleId: id }, { onError: fail });
                  }}
                  onClose={() => setRolePickerFor(null)}
                />
              </View>
            );
          })}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}

      <InviteModal
        visible={inviteOpen}
        roleOptions={roleOptions}
        pending={invite.isPending}
        onClose={() => setInviteOpen(false)}
        onSubmit={(body) =>
          invite.mutate(body, {
            onSuccess: () => {
              showToast('Invitation created (+1 seat)');
              setInviteOpen(false);
            },
            onError: fail,
          })
        }
      />
    </>
  );
}

function InviteModal({
  visible,
  roleOptions,
  pending,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  roleOptions: PickerOption[];
  pending: boolean;
  onClose: () => void;
  onSubmit: (body: { email: string; name?: string; roleId?: string }) => void;
}) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [roleId, setRoleId] = useState<string | null>(null);
  const [rolePicker, setRolePicker] = useState(false);

  const reset = () => {
    setEmail('');
    setName('');
    setRoleId(null);
  };

  const submit = () => {
    if (!email.trim()) {
      showToast('Email is required', 'error');
      return;
    }
    onSubmit({ email: email.trim(), name: name || undefined, roleId: roleId || undefined });
    reset();
  };

  const roleLabel = roleOptions.find((r) => r.id === roleId)?.label ?? 'None';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.sheetHead}>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Text style={styles.sheetTitle}>Invite a teammate</Text>
            <Pressable onPress={submit} hitSlop={10} disabled={pending || !email.trim()}>
              {pending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.save, !email.trim() && { opacity: 0.4 }]}>Send</Text>
              )}
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus
            />
            <Text style={styles.label}>Name</Text>
            <TextInput style={styles.input} value={name} onChangeText={setName} />
            <Text style={styles.label}>Role</Text>
            <Pressable style={styles.field} onPress={() => setRolePicker(true)}>
              <Text style={styles.fieldValue}>{roleLabel}</Text>
              <Icon name="chevronDown" size={16} color={colors.textMuted} />
            </Pressable>
            <Text style={styles.note}>+1 seat = +$30/mo on your next invoice.</Text>
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>

      <PickerModal
        visible={rolePicker}
        title="Role"
        options={roleOptions}
        selectedId={roleId}
        allowClear
        onSelect={(id) => {
          setRoleId(id);
          setRolePicker(false);
        }}
        onClose={() => setRolePicker(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  content: { padding: space.lg, gap: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.xs, gap: space.sm },
  intro: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, flex: 1 },
  inviteBtn: { paddingHorizontal: space.md, minHeight: 40 },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: space.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: space.sm },
  cardName: { flex: 1, gap: 2 },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  email: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, textTransform: 'capitalize' },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rolePick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 7,
    backgroundColor: colors.surface,
  },
  roleValue: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.ink },
  roleStatic: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  // Invite sheet
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
  },
  fieldValue: { fontFamily: fonts.regular, fontSize: fontSize.lg, color: colors.ink },
  note: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted, marginTop: space.sm },
});
