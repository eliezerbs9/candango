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
 * Google Maps key for Places (New) address autocomplete. Set it in a gitignored
 * `apps/mobile/.env` as EXPO_PUBLIC_GOOGLE_MAPS_API_KEY (same key the web uses).
 * When unset, address fields degrade to plain text inputs.
 */
export const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';
