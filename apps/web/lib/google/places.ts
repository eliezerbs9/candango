// Google Places (New) address autocomplete. No-ops gracefully when NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
// isn't set, so address fields work as plain inputs until the key is configured.
/* eslint-disable @typescript-eslint/no-explicit-any */

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

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
export const placesEnabled = () => !!KEY;

let loader: Promise<void> | null = null;
function loadMaps(): Promise<void> | null {
  if (!KEY || typeof window === 'undefined') return null;
  if ((window as any).google?.maps?.importLibrary) return Promise.resolve();
  if (loader) return loader;
  loader = new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(KEY)}&v=weekly&libraries=places&loading=async`;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Failed to load Google Maps'));
    document.head.appendChild(s);
  });
  return loader;
}

let sessionToken: any = null;
const predictions = new Map<string, any>(); // placeId → prediction (for the current input)

/** Address predictions for a typed query (empty array if Places isn't configured/available). */
export async function suggestAddresses(input: string): Promise<AddressSuggestion[]> {
  const p = loadMaps();
  if (!p || !input.trim()) return [];
  try {
    await p;
    const places: any = await (window as any).google.maps.importLibrary('places');
    if (!sessionToken) sessionToken = new places.AutocompleteSessionToken();
    const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
      input,
      sessionToken,
    });
    predictions.clear();
    const out: AddressSuggestion[] = [];
    for (const s of suggestions ?? []) {
      const pred = s.placePrediction;
      if (!pred) continue;
      predictions.set(pred.placeId, pred);
      out.push({ id: pred.placeId, label: pred.text?.text ?? '' });
    }
    return out;
  } catch {
    return [];
  }
}

/** Resolve a chosen suggestion into structured address parts. */
export async function getAddressParts(placeId: string): Promise<AddressParts | null> {
  const pred = predictions.get(placeId);
  if (!pred) return null;
  try {
    const place = pred.toPlace();
    await place.fetchFields({ fields: ['addressComponents'] });
    sessionToken = null; // session ends after a selection
    const comps: any[] = place.addressComponents ?? [];
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
