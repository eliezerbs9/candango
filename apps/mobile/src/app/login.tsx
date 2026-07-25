/**
 * Login screen (email/password). Login-only — no sign-up, no billing (users
 * subscribe on the web). On success stores the JWT + user in the secure store;
 * the root AuthGate then routes into the app.
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

// Finish any pending auth session (no-op on native, needed for web).
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
      // AuthGate redirects to "/" once the token is set.
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
      // Our redirect URI: exp://… inside Expo Go, candango://… in a standalone build.
      const redirectUri = AuthSession.makeRedirectUri({ path: 'auth' });
      const authUrl =
        `${API_URL}/auth/google?mode=signup&platform=mobile` +
        `&redirect=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);
      if (result.type !== 'success' || !result.url) {
        // User dismissed the browser — nothing to do.
        return;
      }
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
              placeholderTextColor="#a1a1aa"
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
              placeholderTextColor="#a1a1aa"
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
                <ActivityIndicator color="#fff" />
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
                <ActivityIndicator color="#52525b" />
              ) : (
                <Text style={styles.googleButtonText}>Continue with Google</Text>
              )}
            </Pressable>
          </View>

          <Text style={styles.hint}>
            No account? Sign up and subscribe on the Candango website.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  container: { flex: 1, padding: 24, justifyContent: 'center', gap: 8 },
  title: { fontSize: 40, fontWeight: '700', textAlign: 'center', color: '#d9552c' },
  subtitle: { fontSize: 15, textAlign: 'center', color: '#71717a', marginBottom: 24 },
  form: { gap: 6 },
  label: { fontSize: 13, color: '#52525b', marginTop: 10 },
  input: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#18181b',
    backgroundColor: '#fafafa',
  },
  error: { color: '#c0362c', fontSize: 13, marginTop: 8 },
  button: {
    backgroundColor: '#d9552c',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 18,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: '#d4d4d8' },
  dividerText: { color: '#a1a1aa', fontSize: 13 },
  googleButton: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
    backgroundColor: '#fff',
  },
  googleButtonText: { color: '#18181b', fontSize: 16, fontWeight: '600' },
  hint: { textAlign: 'center', color: '#a1a1aa', fontSize: 13, marginTop: 24 },
});
