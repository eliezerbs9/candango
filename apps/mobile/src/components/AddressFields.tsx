/** Structured address inputs (mirrors the web AddressFields, minus Places autocomplete). */
import { StyleSheet, Text, TextInput, View } from 'react-native';

import type { Address } from '@/lib/api/types';
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

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      {withName ? (
        <TextInput style={styles.input} placeholder="Name / attention" placeholderTextColor={colors.textSubtle} value={value.name ?? ''} onChangeText={(t) => set('name', t)} />
      ) : null}
      <TextInput style={styles.input} placeholder="Address line 1" placeholderTextColor={colors.textSubtle} value={value.line1 ?? ''} onChangeText={(t) => set('line1', t)} />
      <TextInput style={styles.input} placeholder="Address line 2" placeholderTextColor={colors.textSubtle} value={value.line2 ?? ''} onChangeText={(t) => set('line2', t)} />
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
});
