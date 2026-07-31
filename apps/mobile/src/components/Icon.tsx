/**
 * Single monochrome icon set for the whole app (Ionicons under the hood).
 * Screens reference a *semantic* name (e.g. "deals", "delete") — not a glyph —
 * so the icon language stays consistent and swappable in one place.
 * Keep everything one-color (defaults to the current text ink); the terracotta
 * accent is applied deliberately, never scattered.
 */
import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { colors } from '@/theme';

type Ionicon = ComponentProps<typeof Ionicons>['name'];

/** Semantic name → Ionicons glyph. `[outline, filled]` where a pair is useful. */
const GLYPHS = {
  // tabs
  deals: ['briefcase-outline', 'briefcase'],
  contacts: ['people-outline', 'people'],
  activities: ['calendar-outline', 'calendar'],
  profile: ['person-circle-outline', 'person-circle'],
  // actions
  add: 'add',
  remove: 'remove',
  close: 'close',
  back: 'chevron-back',
  chevronRight: 'chevron-forward',
  chevronDown: 'chevron-down',
  search: 'search',
  check: 'checkmark',
  delete: 'trash-outline',
  edit: 'create-outline',
  more: 'ellipsis-horizontal',
  external: 'open-outline',
  logout: 'log-out-outline',
  settings: 'settings-outline',
  // entities
  company: 'business-outline',
  person: 'person-outline',
  phone: 'call-outline',
  meeting: 'people-circle-outline',
  task: 'checkbox-outline',
  email: 'mail-outline',
  note: 'document-text-outline',
  invoice: 'receipt-outline',
  money: 'cash-outline',
  location: 'location-outline',
  link: 'link-outline',
  warning: 'alert-circle-outline',
  info: 'information-circle-outline',
  // timeline
  stage: 'flag-outline',
  inbound: 'arrow-down-outline',
  outbound: 'arrow-up-outline',
} as const;

export type IconName = keyof typeof GLYPHS;

function glyph(name: IconName, focused: boolean): Ionicon {
  const g = GLYPHS[name];
  return (Array.isArray(g) ? g[focused ? 1 : 0] : g) as Ionicon;
}

export function Icon({
  name,
  size = 20,
  color = colors.textMuted,
  focused = false,
}: {
  name: IconName;
  size?: number;
  color?: string;
  /** For paired icons (tabs), render the filled variant. */
  focused?: boolean;
}) {
  return <Ionicons name={glyph(name, focused)} size={size} color={color} />;
}
