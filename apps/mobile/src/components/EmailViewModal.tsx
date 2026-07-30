/** View an email (formatted body via WebView, with a snippet fallback) + Reply. */
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
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
  snippet: string | null;
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

  const fullBody = body.data && (body.data.html || body.data.text);
  // Fall back to the stored snippet when the full body can't be fetched
  // (e.g. BCC-captured emails have no Gmail message to load from).
  const showingPreviewOnly = !body.isLoading && !fullBody;
  const content = fullBody
    ? htmlDoc(body.data!.html, body.data!.text)
    : htmlDoc(null, email?.snippet ?? 'No preview available for this email.');

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaProvider>
        <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn}>
              <Text style={styles.close}>Close</Text>
            </Pressable>
            <Text style={styles.headerTitle}>Email</Text>
            <Pressable onPress={onReply} hitSlop={12} style={styles.headerBtn}>
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
          ) : (
            <>
              {showingPreviewOnly ? <Text style={styles.previewNote}>Preview only — full message not available.</Text> : null}
              <WebView
                style={styles.web}
                originWhitelist={['*']}
                source={{ html: content }}
                showsVerticalScrollIndicator
              />
            </>
          )}
        </SafeAreaView>
      </SafeAreaProvider>
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
    paddingVertical: space.sm + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: { paddingVertical: 4 },
  headerTitle: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.ink },
  close: { fontFamily: fonts.medium, fontSize: fontSize.md, color: colors.textMuted },
  reply: { fontFamily: fonts.bold, fontSize: fontSize.md, color: colors.primary },
  meta: { paddingHorizontal: space.lg, paddingVertical: space.sm, gap: 2, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  subject: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  previewNote: { fontFamily: fonts.regular, fontSize: fontSize.xs, color: colors.textSubtle, paddingHorizontal: space.lg, paddingTop: space.sm },
  web: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
