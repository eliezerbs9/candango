/** View a formatted email (body via WebView) with a Reply action. */
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';

import { useMessageBody } from '@/lib/api/messages';
import { formatDate } from '@/lib/format';
import { colors, fonts, fontSize, space } from '@/theme';

export type ViewEmail = {
  id: string;
  subject: string;
  from: string;
  direction: 'in' | 'out';
  at: string;
};

function htmlDoc(html: string | null, text: string | null): string {
  const style =
    'body{font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:15px;line-height:1.5;color:#1c1a17;padding:14px;margin:0;word-wrap:break-word;overflow-wrap:break-word}img{max-width:100%;height:auto}a{color:#d9552c}pre{white-space:pre-wrap;word-wrap:break-word;font-family:inherit}';
  const head = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${style}</style></head><body>`;
  if (html) return `${head}${html}</body></html>`;
  const escaped = (text ?? 'No content.').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `${head}<pre>${escaped}</pre></body></html>`;
}

export function EmailViewModal({
  visible,
  email,
  onReply,
  onClose,
}: {
  visible: boolean;
  email: ViewEmail | null;
  onReply: () => void;
  onClose: () => void;
}) {
  const body = useMessageBody(visible ? email?.id ?? null : null);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.close}>Close</Text>
          </Pressable>
          <Pressable onPress={onReply} hitSlop={10}>
            <Text style={styles.reply}>Reply</Text>
          </Pressable>
        </View>

        {email ? (
          <View style={styles.meta}>
            <Text style={styles.subject}>{email.subject}</Text>
            <Text style={styles.sub}>
              {email.direction === 'in' ? 'From' : 'To'} {email.from} · {formatDate(email.at)}
            </Text>
          </View>
        ) : null}

        {body.isLoading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.primary} />
          </View>
        ) : body.isError ? (
          <View style={styles.center}>
            <Text style={styles.err}>Couldn’t load this email.</Text>
          </View>
        ) : (
          <WebView
            style={styles.web}
            originWhitelist={['*']}
            source={{ html: htmlDoc(body.data?.html ?? null, body.data?.text ?? null) }}
            showsVerticalScrollIndicator
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  close: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  reply: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  meta: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  subject: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  err: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.md },
});
