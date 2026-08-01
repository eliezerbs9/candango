/**
 * Shared UI primitives — the app's clean design language in one place.
 * Principles: one accent colour (terracotta), generous whitespace, clearly
 * bounded sections, buttons that always read as buttons, and tap targets ≥44pt.
 * Prefer these over ad-hoc <Pressable>/<View> styling so every screen matches.
 */
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  Text,
  View,
  type ViewProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/Icon';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

/** Full-screen container that respects the device safe areas (notch/home bar). */
export function Screen({
  children,
  edges = ['top', 'left', 'right'],
  style,
}: {
  children: ReactNode;
  edges?: Edge[];
  style?: ViewStyle;
}) {
  return (
    <SafeAreaView style={[ui.screen, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** A bounded surface — the standard way to group related content. */
export function Card({ children, style, ...rest }: ViewProps & { children: ReactNode }) {
  return (
    <View style={[ui.card, style]} {...rest}>
      {children}
    </View>
  );
}

/** Small uppercase label that marks where a section starts. */
export function SectionHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View style={ui.sectionHeader}>
      <Text style={ui.sectionTitle}>{title.toUpperCase()}</Text>
      {action}
    </View>
  );
}

/** Hairline divider for separating rows within a card. */
export function Divider({ inset = 0 }: { inset?: number }) {
  return <View style={[ui.divider, inset ? { marginLeft: inset } : null]} />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  icon,
  loading,
  disabled,
  fullWidth,
  style,
}: {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  icon?: IconName;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: ViewStyle;
}) {
  const off = disabled || loading;
  const v = BTN[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off }}
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        ui.btn,
        v.box,
        fullWidth && ui.btnFull,
        pressed && !off && ui.btnPressed,
        off && ui.btnDisabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={v.fg} />
      ) : (
        <>
          {icon ? <Icon name={icon} size={18} color={v.fg} /> : null}
          <Text style={[ui.btnText, { color: v.fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const BTN: Record<ButtonVariant, { box: ViewStyle; fg: string }> = {
  primary: { box: { backgroundColor: colors.primary }, fg: colors.white },
  secondary: { box: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.borderStrong }, fg: colors.ink },
  ghost: { box: { backgroundColor: 'transparent' }, fg: colors.primary },
  danger: { box: { backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.danger }, fg: colors.danger },
};

/** Icon-only button — accessibilityLabel is required (screen-reader support). */
export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  color = colors.textMuted,
  size = 22,
  disabled,
  ...rest
}: {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  color?: string;
  size?: number;
  disabled?: boolean;
} & Omit<PressableProps, 'onPress' | 'children' | 'style'>) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      hitSlop={10}
      style={({ pressed }) => [ui.iconBtn, pressed && !disabled && ui.btnPressed, disabled && ui.btnDisabled]}
      {...rest}
    >
      <Icon name={icon} size={size} color={color} />
    </Pressable>
  );
}

/** Selectable pill — the standard filter/segment control. */
export function Chip({ label, on, onPress }: { label: string; on: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      onPress={onPress}
      style={[ui.chip, on && ui.chipOn]}
    >
      <Text style={[ui.chipText, on && ui.chipTextOn]}>{label}</Text>
    </Pressable>
  );
}

const ui = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    ...shadow.card,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    marginBottom: space.sm,
  },
  sectionTitle: {
    fontFamily: fonts.semibold,
    fontSize: fontSize.xs,
    letterSpacing: 0.8,
    color: colors.textSubtle,
  },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  // Buttons
  btn: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.lg,
  },
  btnFull: { alignSelf: 'stretch' },
  btnText: { fontFamily: fonts.semibold, fontSize: fontSize.lg },
  btnPressed: { opacity: 0.7 },
  btnDisabled: { opacity: 0.45 },
  iconBtn: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  // Chips
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: colors.bg,
  },
  chipOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted },
  chipTextOn: { fontFamily: fonts.semibold, color: colors.white },
});
