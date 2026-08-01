/**
 * Login screen. Sign-in is delegated to the web login page (email/password +
 * Google + future SSO) opened in a browser session — the "single Log in button"
 * pattern (like Pipedrive). The web page hands the JWT back via the
 * `candango://auth` deep link. No native social-login buttons live in the app,
 * so Apple guideline 4.8 (Sign in with Apple) doesn't apply. Login-only: sign-up
 * and billing happen on the website.
 */
import * as AuthSession from 'expo-auth-session';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';
import { WEB_URL } from '@/config';
import { getMe } from '@/lib/api/auth';
import { useAuthStore } from '@/lib/auth/store';
import { colors, fonts, fontSize, radius, space } from '@/theme';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const signIn = useAuthStore((s) => s.signIn);

  async function onLogin() {
    setErrorMsg(null);
    setBusy(true);
    try {
      const redirectUri = AuthSession.makeRedirectUri({ path: 'auth' });
      const loginUrl = `${WEB_URL}/login?platform=mobile&redirect=${encodeURIComponent(redirectUri)}`;
      const result = await WebBrowser.openAuthSessionAsync(loginUrl, redirectUri);
      if (result.type !== 'success' || !result.url) return; // user closed the sheet
      const { queryParams } = Linking.parse(result.url);
      if (queryParams?.error) {
        setErrorMsg('Sign in failed. Please try again.');
        return;
      }
      const token = typeof queryParams?.token === 'string' ? queryParams.token : null;
      if (!token) {
        setErrorMsg('Sign in did not return a token.');
        return;
      }
      const user = await getMe(token);
      signIn(token, user); // navigates into the app
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <View style={styles.brand}>
          <Image source={require('../../assets/images/icon.png')} style={styles.logo} />
          <Text style={styles.title}>Candango</Text>
          <Text style={styles.subtitle}>Sign in to your workspace</Text>
        </View>

        {errorMsg ? <Text style={styles.error}>{errorMsg}</Text> : null}

        <Button label="Log in" onPress={onLogin} loading={busy} fullWidth />

        <Text style={styles.hint}>No account? Sign up and subscribe on the Candango website.</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { flex: 1, padding: space.lg, justifyContent: 'center', gap: space.md },
  brand: { alignItems: 'center', gap: space.xs, marginBottom: space.lg },
  logo: { width: 72, height: 72, borderRadius: radius.xl },
  title: {
    fontFamily: fonts.display,
    fontSize: fontSize.display,
    textAlign: 'center',
    color: colors.ink,
    letterSpacing: -1,
    marginTop: space.sm,
  },
  subtitle: { fontFamily: fonts.regular, fontSize: fontSize.lg, textAlign: 'center', color: colors.textMuted },
  error: { fontFamily: fonts.medium, color: colors.danger, fontSize: fontSize.sm, textAlign: 'center' },
  hint: {
    fontFamily: fonts.regular,
    textAlign: 'center',
    color: colors.textSubtle,
    fontSize: fontSize.sm,
    marginTop: space.sm,
  },
});
