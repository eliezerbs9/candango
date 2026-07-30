/** Structured address inputs with Google Places autocomplete on the street line
 * (mirrors the web AddressFields). Start typing line 1 → pick a suggestion →
 * city/state/postal/country auto-fill. Degrades to a plain input when Places
 * isn't configured (no EXPO_PUBLIC_GOOGLE_MAPS_API_KEY). */
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { Address } from '@/lib/api/types';
import {
  getAddressParts,
  placesEnabled,
  suggestAddresses,
  type AddressSuggestion,
} from '@/lib/google/places';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export function AddressFields({
  label,
  value,
  onChange,
  withName = true,
}: {
  label: string;
  value: Address;
  onChange: (a: Address) => void;
  withName?: boolean;
}) {
  const set = (k: keyof Address, v: string) => onChange({ ...value, [k]: v });

  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onLine1Change = (v: string) => {
    set('line1', v);
    if (!placesEnabled()) return;
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) {
      setSuggestions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    timer.current = setTimeout(async () => {
      const s = await suggestAddresses(v);
      setSuggestions(s);
      setLoading(false);
    }, 250);
  };

  const pick = async (s: AddressSuggestion) => {
    setSuggestions([]);
    const parts = await getAddressParts(s.id);
    onChange({
      ...value,
      line1: parts?.line1 ?? s.label,
      city: parts?.city ?? value.city ?? '',
      state: parts?.state ?? value.state ?? '',
      postalCode: parts?.postalCode ?? value.postalCode ?? '',
      country: parts?.country ?? value.country ?? '',
    });
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {withName ? (
        <TextInput
          style={styles.input}
          placeholder="Name / attention"
          placeholderTextColor={colors.textSubtle}
          value={value.name ?? ''}
          onChangeText={(t) => set('name', t)}
        />
      ) : null}

      <TextInput
        style={styles.input}
        placeholder={placesEnabled() ? 'Start typing an address…' : 'Address line 1'}
        placeholderTextColor={colors.textSubtle}
        value={value.line1 ?? ''}
        onChangeText={onLine1Change}
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} style={styles.spinner} />
      ) : suggestions.length > 0 ? (
        <View style={styles.suggestBox}>
          {suggestions.map((s) => (
            <Pressable key={s.id} style={styles.suggestRow} onPress={() => pick(s)}>
              <Text style={styles.suggestText} numberOfLines={2}>
                {s.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}

      <TextInput
        style={styles.input}
        placeholder="Address line 2"
        placeholderTextColor={colors.textSubtle}
        value={value.line2 ?? ''}
        onChangeText={(t) => set('line2', t)}
      />
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.half]} placeholder="City" placeholderTextColor={colors.textSubtle} value={value.city ?? ''} onChangeText={(t) => set('city', t)} />
        <TextInput style={[styles.input, styles.half]} placeholder="State / region" placeholderTextColor={colors.textSubtle} value={value.state ?? ''} onChangeText={(t) => set('state', t)} />
      </View>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.half]} placeholder="Postal code" placeholderTextColor={colors.textSubtle} value={value.postalCode ?? ''} onChangeText={(t) => set('postalCode', t)} />
        <TextInput style={[styles.input, styles.half]} placeholder="Country" placeholderTextColor={colors.textSubtle} value={value.country ?? ''} onChangeText={(t) => set('country', t)} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs + 2, marginTop: space.sm },
  label: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
  },
  row: { flexDirection: 'row', gap: space.sm },
  half: { flex: 1 },
  spinner: { alignSelf: 'flex-start', marginVertical: space.xs },
  suggestBox: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: colors.bg,
    overflow: 'hidden',
  },
  suggestRow: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  suggestText: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.ink },
});
