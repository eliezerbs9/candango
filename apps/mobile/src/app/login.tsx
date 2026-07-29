/**
 * Login screen (email/password + Google). Login-only — no sign-up, no billing.
 */
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { getMe, useLogin } from '@/lib/api/auth';
import { ApiError } from '@/lib/api/client';
import { API_URL } from '@/config';
import { useAuthStore } from '@/lib/auth/store';
import { colors, fonts, fontSize, radius, space } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [googleBusy, setGoogleBusy] = useState(false);
  const signIn = useAuthStore((s) => s.signIn);
  const { mutateAsync, isPending } = useLogin();

  const canSubmit = email.trim().length > 0 && password.length > 0 && !isPending;

  async function onSubmit() {
    setErrorMsg(null);
    try {
      const { token, user } = await mutateAsync({ email: email.trim(), password });
      signIn(token, user);
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        setErrorMsg('Incorrect email or password.');
      } else {
        setErrorMsg(e instanceof Error ? e.message : 'Sign in failed. Please try again.');
      }
    }
  }

  async function onGoogle() {
    setErrorMsg(null);
    setGoogleBusy(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ path: 'auth' });
      const authUrl =
        `${API_URL}/auth/google?mode=signup&platform=mobile` +
        `&redirect=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) return;
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error) {
        setErrorMsg('Google sign-in failed. Please try again.');
        return;
      }
      const token = typeof queryParams?.token === 'string' ? queryParams.token : null;
      if (!token) {
        setErrorMsg('Google sign-in did not return a token.');
        return;
      }
      const user = await getMe(token);
      signIn(token, user);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Google sign-in failed.');
    } finally {
      setGoogleBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.container}>
          <Text style={styles.title}>Candango</Text>
          <Text style={styles.subtitle}>Sign in to your account</Text>

          <View style={styles.form}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="you@company.com"
              placeholderTextColor={colors.textSubtle}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              editable={!isPending}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              placeholderTextColor={colors.textSubtle}
              secureTextEntry
              textContentType="password"
              editable={!isPending}
              onSubmitEditing={() => canSubmit && onSubmit()}
              returnKeyType="go"
            />

            {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

            <Pressable
              style={[styles.button, !canSubmit && styles.buttonDisabled]}
              onPress={onSubmit}
              disabled={!canSubmit}
            >
              {isPending ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Sign in</Text>
              )}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={styles.divider} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.divider} />
            </View>

            <Pressable
              style={[styles.googleButton, googleBusy && styles.buttonDisabled]}
              onPress={onGoogle}
              disabled={googleBusy}
            >
              {googleBusy ? (
                <ActivityIndicator color={colors.textMuted} />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>No account? Sign up and subscribe on the Candango website.</Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  container: { flex: 1, padding: space.lg, justifyContent: 'center', gap: space.sm },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    textAlign: 'center',
    color: colors.primary,
    letterSpacing: -1,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: fontSize.lg,
    textAlign: 'center',
    color: colors.textMuted,
    marginBottom: space.lg,
  },
  form: { gap: space.xs + 2 },
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
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, marginTop: space.sm },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.md + 2,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: fontSize.lg, fontFamily: fonts.semibold },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm + 2, marginTop: space.md },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  dividerText: { fontFamily: fonts.regular, color: colors.textSubtle, fontSize: fontSize.sm },
  googleButton: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: space.md,
    backgroundColor: colors.bg,
  },
  googleButtonText: { color: colors.ink, fontSize: fontSize.lg, fontFamily: fonts.semibold },
  hint: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    marginTop: space.lg,
  },
});
