/**
 * Google Places (New) address autocomplete for React Native — mirrors the web
 * apps/web/lib/google/places.ts, but calls the Places REST API over fetch (the
 * browser JS SDK the web uses isn't available here). No-ops gracefully when
 * EXPO_PUBLIC_GOOGLE_MAPS_API_KEY isn't set, so address fields stay plain inputs.
 */
import { GOOGLE_MAPS_API_KEY as KEY } from '@/config';

export interface AddressParts {
  line1?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}
export interface AddressSuggestion {
  id: string;
  label: string;
}

export const placesEnabled = () => !!KEY;

// A session token groups the autocomplete keystrokes + the final details fetch
// into one billable session (Google's recommendation). Cleared after a pick.
let sessionToken: string | null = null;
function token(): string {
  if (!sessionToken) sessionToken = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return sessionToken;
}

type AddressComponent = { types?: string[]; longText?: string; shortText?: string };

/** Address predictions for a typed query (empty when Places isn't configured). */
export async function suggestAddresses(input: string): Promise<AddressSuggestion[]> {
  if (!KEY || !input.trim()) return [];
  try {
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': KEY },
      body: JSON.stringify({ input, sessionToken: token() }),
    });
    if (!res.ok) return [];
    const data = (await res.json()) as {
      suggestions?: { placePrediction?: { placeId: string; text?: { text?: string } } }[];
    };
    const out: AddressSuggestion[] = [];
    for (const s of data.suggestions ?? []) {
      const pred = s.placePrediction;
      if (!pred) continue;
      out.push({ id: pred.placeId, label: pred.text?.text ?? '' });
    }
    return out;
  } catch {
    return [];
  }
}

/** Resolve a chosen suggestion into structured address parts. */
export async function getAddressParts(placeId: string): Promise<AddressParts | null> {
  if (!KEY) return null;
  try {
    const res = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}?sessionToken=${encodeURIComponent(token())}`,
      { headers: { 'X-Goog-Api-Key': KEY, 'X-Goog-FieldMask': 'addressComponents' } },
    );
    sessionToken = null; // session ends after a selection
    if (!res.ok) return null;
    const place = (await res.json()) as { addressComponents?: AddressComponent[] };
    const comps = place.addressComponents ?? [];
    const find = (type: string) => comps.find((c) => c.types?.includes(type));
    const num = find('street_number')?.longText ?? '';
    const route = find('route')?.longText ?? '';
    return {
      line1: [num, route].filter(Boolean).join(' ') || undefined,
      city: (find('locality') ?? find('postal_town') ?? find('administrative_area_level_2'))?.longText,
      state: find('administrative_area_level_1')?.shortText,
      postalCode: find('postal_code')?.longText,
      country: find('country')?.longText,
    };
  } catch {
    return null;
  }
}
