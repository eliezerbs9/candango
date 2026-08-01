/**
 * App configuration.
 *
 * During development the mobile app talks to the PRODUCTION API (decision
 * 2026-07-24): the phone reaches it over the internet with zero network
 * setup. Override with EXPO_PUBLIC_API_URL when pointing at a local API.
 *
 * All Candango API routes live under the `/v1` prefix.
 */
export const API_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'https://app.candango.bsbtechub.com/v1';

/**
 * Web app base URL — the login page lives here. Sign-in is delegated to the web
 * login (email/password + Google + future SSO) in a browser session, which
 * hands the token back via the `candango://auth` deep link. This keeps native
 * social-login buttons out of the app, so Apple's guideline 4.8 (Sign in with
 * Apple) doesn't apply. Derived from API_URL (strip `/v1`); override with
 * EXPO_PUBLIC_WEB_URL for a local web app.
 */
export const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? API_URL.replace(/\/v1\/?$/, '');

/**
 * Google Maps key for Places (New) address autocomplete. Set it in a gitignored
 * `apps/mobile/.env` as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (same key the web uses).
 * When unset, address fields degrade to plain text inputs.
 */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
