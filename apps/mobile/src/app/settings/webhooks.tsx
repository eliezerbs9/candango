/**
 * Settings → Webhooks. Mirrors apps/web/app/(app)/settings/webhooks/page.tsx:
 * admin-only; list endpoints (url, events, active toggle), create (url + events)
 * with the signing secret shown once, send a test event (ping), view recent
 * deliveries and replay them, and delete endpoints.
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
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon } from '@/components/Icon';
import { MultiPickerModal } from '@/components/MultiPickerModal';
import { Button, IconButton } from '@/components/ui';
import {
  useCreateWebhook,
  useDeleteWebhook,
  usePingWebhook,
  useReplayDelivery,
  useUpdateWebhook,
  useWebhookDeliveries,
  useWebhooks,
} from '@/lib/api/webhooks';
import { useAuthStore } from '@/lib/auth/store';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

import { settingsHeaderOptions } from './_header';

const EVENTS = [
  'deal.created',
  'deal.updated',
  'deal.deleted',
  'deal.stage_changed',
  'deal.won',
  'deal.lost',
  'person.created',
  'person.updated',
  'person.deleted',
  'company.created',
  'company.updated',
  'activity.created',
  'activity.completed',
];

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  success: { bg: colors.successTint, fg: colors.success },
  failed: { bg: colors.dangerTint, fg: colors.danger },
  pending: { bg: colors.primaryTint, fg: colors.primary },
};

export default function WebhooksScreen() {
  const role = useAuthStore((s) => s.user?.role);
  const isAdmin = role === 'Admin';

  const { data: webhooks = [], isLoading } = useWebhooks(isAdmin);
  const create = useCreateWebhook();
  const update = useUpdateWebhook();
  const del = useDeleteWebhook();
  const ping = usePingWebhook();

  const [modalOpen, setModalOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [events, setEvents] = useState<string[]>([]);
  const [eventPicker, setEventPicker] = useState(false);
  const [secret, setSecret] = useState<string | null>(null);
  const [deliveriesFor, setDeliveriesFor] = useState<string | null>(null);

  const fail = (e: unknown) => showToast(e instanceof Error ? e.message : 'Something went wrong', 'error');

  const openCreate = () => {
    setUrl('');
    setEvents([]);
    setSecret(null);
    setModalOpen(true);
  };

  const submit = () => {
    if (!url.trim() || events.length === 0) {
      showToast('URL and at least one event are required', 'error');
      return;
    }
    create.mutate({ url: url.trim(), eventTypes: events }, { onSuccess: (data) => setSecret(data.secret), onError: fail });
  };

  if (!isAdmin) {
    return (
      <>
        <Stack.Screen options={settingsHeaderOptions('Webhooks')} />
        <View style={styles.center}>
          <Text style={styles.dim}>Only admins can manage webhooks.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={settingsHeaderOptions('Webhooks')} />
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
          <View style={styles.headRow}>
            <Text style={styles.intro}>Signed event deliveries to your endpoints.</Text>
            <Button label="Add" icon="add" onPress={openCreate} style={styles.addBtn} />
          </View>

          {webhooks.length === 0 ? (
            <Text style={styles.dim}>No webhooks yet.</Text>
          ) : (
            webhooks.map((w) => (
              <View key={w.id} style={styles.card}>
                <View style={styles.cardTop}>
                  <Text style={styles.url} numberOfLines={1}>
                    {w.url}
                  </Text>
                  <Switch
                    value={w.isActive}
                    onValueChange={(v) => update.mutate({ id: w.id, isActive: v }, { onError: fail })}
                    trackColor={{ true: colors.primary, false: colors.borderStrong }}
                    thumbColor={colors.white}
                  />
                </View>
                <View style={styles.eventRow}>
                  {w.eventTypes.map((e) => (
                    <View key={e} style={styles.eventChip}>
                      <Text style={styles.eventText}>{e}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.actions}>
                  <IconButton
                    icon="outbound"
                    accessibilityLabel="Send test event"
                    size={18}
                    onPress={() =>
                      ping.mutate(w.id, { onSuccess: () => showToast('Test event sent'), onError: fail })
                    }
                  />
                  <IconButton
                    icon="note"
                    accessibilityLabel="View deliveries"
                    size={18}
                    onPress={() => setDeliveriesFor(w.id)}
                  />
                  <IconButton
                    icon="delete"
                    accessibilityLabel="Delete webhook"
                    size={18}
                    color={colors.danger}
                    onPress={() => del.mutate(w.id, { onSuccess: () => showToast('Webhook deleted'), onError: fail })}
                  />
                </View>
              </View>
            ))
          )}
          <View style={{ height: space.xl }} />
        </ScrollView>
      )}

      {/* Create modal */}
      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <SafeAreaView style={styles.sheet}>
            <View style={styles.sheetHead}>
              <Pressable onPress={() => setModalOpen(false)} hitSlop={10}>
                <Text style={styles.cancel}>{secret ? 'Done' : 'Cancel'}</Text>
              </Pressable>
              <Text style={styles.sheetTitle}>Add webhook</Text>
              {secret ? (
                <View style={{ width: 48 }} />
              ) : (
                <Pressable onPress={submit} hitSlop={10} disabled={create.isPending || !url.trim() || events.length === 0}>
                  {create.isPending ? (
                    <ActivityIndicator size="small" color={colors.primary} />
                  ) : (
                    <Text style={[styles.save, (!url.trim() || events.length === 0) && { opacity: 0.4 }]}>Create</Text>
                  )}
                </Pressable>
              )}
            </View>

            {secret ? (
              <View style={styles.form}>
                <Text style={styles.secretNote}>
                  Save this signing secret now — you won&apos;t see it again. Use it to verify the
                  {' '}X-Candango-Signature header. Long-press to copy.
                </Text>
                <Text style={styles.secretBox} selectable>
                  {secret}
                </Text>
              </View>
            ) : (
              <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                <Text style={styles.formLabel}>Endpoint URL</Text>
                <TextInput
                  style={styles.input}
                  value={url}
                  onChangeText={setUrl}
                  placeholder="https://hooks.yourapp.com/candango"
                  placeholderTextColor={colors.textSubtle}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="url"
                  autoFocus
                />
                <Text style={styles.formLabel}>Events</Text>
                <Pressable style={styles.field} onPress={() => setEventPicker(true)}>
                  <Text style={styles.fieldValue} numberOfLines={2}>
                    {events.length ? events.join(', ') : 'Pick events'}
                  </Text>
                  <Icon name="chevronRight" size={16} color={colors.textMuted} />
                </Pressable>
              </ScrollView>
            )}
          </SafeAreaView>
        </KeyboardAvoidingView>

        <MultiPickerModal
          visible={eventPicker}
          title="Events"
          options={EVENTS.map((e) => ({ id: e, label: e }))}
          selectedIds={events}
          onChange={setEvents}
          onClose={() => setEventPicker(false)}
        />
      </Modal>

      <DeliveriesModal webhookId={deliveriesFor} onClose={() => setDeliveriesFor(null)} />
    </>
  );
}

function DeliveriesModal({ webhookId, onClose }: { webhookId: string | null; onClose: () => void }) {
  const { data: deliveries = [], isLoading } = useWebhookDeliveries(webhookId);
  const replay = useReplayDelivery();

  return (
    <Modal visible={!!webhookId} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.sheet} edges={['bottom']}>
          <View style={styles.sheetHead}>
            <View style={{ width: 48 }} />
            <Text style={styles.sheetTitle}>Recent deliveries</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.cancel}>Done</Text>
            </Pressable>
          </View>
          {isLoading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.primary} />
            </View>
          ) : deliveries.length === 0 ? (
            <Text style={[styles.dim, styles.emptyPad]}>No deliveries yet. Use the test button to send an event.</Text>
          ) : (
            <ScrollView contentContainerStyle={styles.deliveries}>
              {deliveries.map((d) => {
                const tone = STATUS_TONE[d.status] ?? STATUS_TONE.pending;
                return (
                  <View key={d.id} style={styles.deliveryRow}>
                    <View style={styles.deliveryText}>
                      <View style={styles.deliveryTop}>
                        <View style={[styles.badge, { backgroundColor: tone.bg }]}>
                          <Text style={[styles.badgeText, { color: tone.fg }]}>{d.status}</Text>
                        </View>
                        <Text style={styles.deliveryType}>{d.payload?.type ?? '—'}</Text>
                      </View>
                      <Text style={styles.deliveryMeta}>
                        attempt {d.attempt} · HTTP {d.responseCode ?? '—'} · {new Date(d.createdAt).toLocaleString()}
                      </Text>
                    </View>
                    <Button
                      label="Replay"
                      variant="secondary"
                      loading={replay.isPending}
                      onPress={() =>
                        replay.mutate(d.id, {
                          onSuccess: () => showToast('Replay queued'),
                          onError: () => showToast('Replay failed', 'error'),
                        })
                      }
                      style={styles.replayBtn}
                    />
                  </View>
                );
              })}
            </ScrollView>
          )}
        </SafeAreaView>
      </View>
    </Modal>
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
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  url: { fontFamily: fonts.mono, fontSize: fontSize.sm, color: colors.ink, flex: 1 },
  eventRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  eventChip: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 3 },
  eventText: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.primary },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 2 },
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
  // deliveries
  loading: { paddingVertical: space.xl, alignItems: 'center' },
  emptyPad: { padding: space.lg },
  deliveries: { padding: space.lg, gap: space.sm },
  deliveryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: space.md,
    backgroundColor: colors.surface,
  },
  deliveryText: { flex: 1, gap: 4 },
  deliveryTop: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  badge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontFamily: fonts.semibold, fontSize: fontSize.xs, textTransform: 'capitalize' },
  deliveryType: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.ink },
  deliveryMeta: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textMuted },
  replayBtn: { paddingHorizontal: space.md, minHeight: 40 },
});
