/** A simple bottom-sheet single-select picker with search. */
import { useMemo, useState } from 'react';
import {
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

import { colors, fonts, fontSize, radius, space } from '@/theme';

export type PickerOption = { id: string; label: string; sub?: string };

export function PickerModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
  allowClear,
}: {
  visible: boolean;
  title: string;
  options: PickerOption[];
  selectedId?: string | null;
  onSelect: (id: string | null) => void;
  onClose: () => void;
  allowClear?: boolean;
}) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return options;
    return options.filter((o) => o.label.toLowerCase().includes(t) || o.sub?.toLowerCase().includes(t));
  }, [q, options]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
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

          <FlatList
            data={filtered}
            keyExtractor={(o) => o.id}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            ListHeaderComponent={
              allowClear ? (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(null);
                    onClose();
                  }}
                >
                  <Text style={[styles.rowLabel, styles.clear]}>None</Text>
                </Pressable>
              ) : null
            }
            ListEmptyComponent={<Text style={styles.empty}>No results.</Text>}
            renderItem={({ item }) => {
              const sel = item.id === selectedId;
              return (
                <Pressable
                  style={styles.row}
                  onPress={() => {
                    onSelect(item.id);
                    onClose();
                  }}
                >
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
                  {sel ? <Text style={styles.check}>✓</Text> : null}
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
  list: { marginBottom: space.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 13,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 10,
  },
  rowLabel: { fontFamily: fonts.medium, fontSize: fontSize.lg, color: colors.ink },
  rowSub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted, marginTop: 1 },
  clear: { color: colors.textMuted },
  check: { fontFamily: fonts.bold, color: colors.primary, fontSize: fontSize.lg },
  empty: { fontFamily: fonts.regular, color: colors.textSubtle, textAlign: 'center', padding: space.lg },
});
