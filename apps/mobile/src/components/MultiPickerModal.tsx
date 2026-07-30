/** A bottom-sheet multi-select picker with search + optional inline create.
 * Sibling of PickerModal (single-select); toggling a row keeps the sheet open. */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { PickerOption } from '@/components/PickerModal';
import { colors, fonts, fontSize, radius, space } from '@/theme';

export function MultiPickerModal({
  visible,
  title,
  options,
  selectedIds,
  onChange,
  onClose,
  onCreate,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onClose: () => void;
  /** When set, shows a "+ Create '<query>'" row; must return the new id. */
  onCreate?: (label: string) => Promise<string | null>;
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t) || o.sub?.toLowerCase().includes(t));
  }, [q, options]);

  const query = q.trim();
  const exactMatch = options.some((o) => o.label.toLowerCase() === query.toLowerCase());
  const canCreate = !!onCreate && query.length > 0 && !exactMatch;

  function toggle(id: string) {
    onChange(selectedIds.includes(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }

  async function create() {
    if (!onCreate || !query) return;
    setCreating(true);
    try {
      const id = await onCreate(query);
      if (id) {
        onChange([...selectedIds, id]);
        setQ('');
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.backdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <SafeAreaView style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Text style={styles.close}>Done</Text>
            </Pressable>
          </View>

          <TextInput
            style={styles.search}
            placeholder="Search…"
            placeholderTextColor={colors.textSubtle}
            value={q}
            onChangeText={setQ}
            autoCorrect={false}
          />

          {canCreate ? (
            <Pressable style={styles.createRow} onPress={create} disabled={creating}>
              {creating ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.createText}>＋ Create “{query}”</Text>
              )}
            </Pressable>
          ) : null}

          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListEmptyComponent={<Text style={styles.empty}>No results.</Text>}
            renderItem={({ item }) => {
              const sel = selectedIds.includes(item.id);
              return (
                <Pressable style={styles.row} onPress={() => toggle(item.id)}>
                  <View style={[styles.checkbox, sel && styles.checkboxOn]}>
                    {sel ? <Text style={styles.checkboxTick}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowLabel} numberOfLines={1}>
                      {item.label}
                    </Text>
                    {item.sub ? (
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {item.sub}
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            }}
          />
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    maxHeight: '80%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: space.sm },
  title: { fontFamily: fonts.display, fontSize: fontSize.xl, color: colors.ink },
  close: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.primary },
  search: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
    backgroundColor: colors.surface,
    marginBottom: space.sm,
  },
  createRow: {
    paddingVertical: 12,
    paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  createText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.primary },
  list: { marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxTick: { color: colors.white, fontFamily: fonts.bold, fontSize: fontSize.sm },
  rowLabel: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
  empty: { fontFamily: fonts.regular, color: colors.textSubtle, textAlign: 'center', padding: space.lg },
});
