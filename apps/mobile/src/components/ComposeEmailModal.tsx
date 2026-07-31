/** Compose / reply to an email, sent via the connected Gmail and linked to a deal. */
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

import { useSendMessage } from '@/lib/api/messages';
import { showToast } from '@/lib/toast';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export type ComposeInitial = {
  to?: string[];
  subject?: string;
  threadId?: string;
  inReplyTo?: string;
};

export function ComposeEmailModal({
  visible,
  dealId,
  initial,
  onClose,
}: {
  visible: boolean;
  dealId?: string;
  initial?: ComposeInitial;
  onClose: () => void;
}) {
  const send = useSendMessage(dealId);
  const [to, setTo] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setTo((initial?.to ?? []).join(', '));
    setSubject(initial?.subject ?? '');
    setBody('');
    setError(null);
  }, [visible, initial]);

  const recipients = to
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const canSend = recipients.length > 0 && subject.trim().length > 0 && body.trim().length > 0 && !send.isPending;

  async function submit() {
    setError(null);
    try {
      await send.mutateAsync({
        to: recipients,
        subject: subject.trim(),
        body: body,
        dealId,
        threadId: initial?.threadId,
        inReplyTo: initial?.inReplyTo,
      });
      showToast('Email sent');
      onClose();
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Could not send. Make sure Gmail is connected (Settings → Integrations on the web).',
      );
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
            <Text style={styles.title}>{initial?.inReplyTo ? 'Reply' : 'New email'}</Text>
            <Pressable onPress={submit} hitSlop={10} disabled={!canSend}>
              {send.isPending ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.send, !canSend && { opacity: 0.4 }]}>Send</Text>
              )}
            </Pressable>
          </View>

          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.form}>
            <Text style={styles.label}>To</Text>
            <TextInput
              style={styles.input}
              value={to}
              onChangeText={setTo}
              placeholder="name@company.com, …"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              keyboardType="email-address"
              autoCorrect={false}
            />

            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Subject"
              placeholderTextColor={colors.textSubtle}
            />

            <Text style={styles.label}>Message</Text>
            <TextInput
              style={[styles.input, styles.bodyInput]}
              value={body}
              onChangeText={setBody}
              placeholder="Write your message…"
              placeholderTextColor={colors.textSubtle}
              multiline
              textAlignVertical="top"
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
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
  send: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  form: { padding: space.lg, gap: space.xs + 2 },
  label: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, marginTop: space.sm + 2 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  bodyInput: { minHeight: 160 },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
});
