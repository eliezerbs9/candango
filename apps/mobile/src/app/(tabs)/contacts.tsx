/**
 * Contacts tab — People and Companies, toggled by a segmented control.
 * Search, tap a card to edit, ＋ to create (create/edit/delete via ContactFormModal).
 */
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { ContactFormModal } from '@/components/ContactFormModal';
import { Icon } from '@/components/Icon';
import { useCompanies, usePersons } from '@/lib/api/contacts';
import type { ApiCompany, ApiPerson } from '@/lib/api/types';
import { colors, fonts, fontSize, radius, shadow, space } from '@/theme';

type Tab = 'people' | 'companies';

export default function ContactsScreen() {
  const [tab, setTab] = useState<Tab>('people');
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiPerson | ApiCompany | null>(null);
  const persons = usePersons();
  const companies = useCompanies();
  const active = tab === 'people' ? persons : companies;

  const filteredPeople = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = persons.data ?? [];
    if (!t) return list;
    return list.filter(
      (p) =>
        p.name.toLowerCase().includes(t) ||
        p.email?.toLowerCase().includes(t) ||
        p.phone?.toLowerCase().includes(t) ||
        p.companies.some((c) => c.name.toLowerCase().includes(t)),
    );
  }, [persons.data, search]);

  const filteredCompanies = useMemo(() => {
    const t = search.trim().toLowerCase();
    const list = companies.data ?? [];
    if (!t) return list;
    return list.filter(
      (c) =>
        c.name.toLowerCase().includes(t) ||
        c.domain?.toLowerCase().includes(t) ||
        c.phone?.toLowerCase().includes(t) ||
        c.contacts.some((p) => p.name.toLowerCase().includes(t)),
    );
  }, [companies.data, search]);

  const openCreate = () => {
    setEditing(null);
    setFormOpen(true);
  };
  const openEdit = (item: ApiPerson | ApiCompany) => {
    setEditing(item);
    setFormOpen(true);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.top}>
        <View style={styles.segment}>
          <Segment label="People" active={tab === 'people'} onPress={() => setTab('people')} />
          <Segment label="Companies" active={tab === 'companies'} onPress={() => setTab('companies')} />
        </View>
        <View style={styles.searchBox}>
          <Icon name="search" size={18} color={colors.textSubtle} />
          <TextInput
            style={styles.search}
            placeholder={tab === 'people' ? 'Search people…' : 'Search companies…'}
            placeholderTextColor={colors.textSubtle}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
          />
        </View>
      </View>

      {active.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'people' ? (
        <FlatList
          data={filteredPeople}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, filteredPeople.length === 0 && styles.grow]}
          refreshControl={
            <RefreshControl refreshing={persons.isRefetching} onRefresh={() => persons.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={<Empty label={search ? 'No matches.' : 'No people yet.'} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => openEdit(item)}
            >
              <View style={styles.avatar}>
                <Icon name="person" size={20} color={colors.textMuted} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                {item.email ? <Text style={styles.sub}>{item.email}</Text> : null}
                {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
                <View style={styles.relRow}>
                  <Icon name="company" size={13} color={colors.textSubtle} />
                  <Text style={styles.rel} numberOfLines={2}>
                    {item.companies.length ? item.companies.map((c) => c.name).join(', ') : 'No company'}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          data={filteredCompanies}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, filteredCompanies.length === 0 && styles.grow]}
          refreshControl={
            <RefreshControl refreshing={companies.isRefetching} onRefresh={() => companies.refetch()} tintColor={colors.primary} />
          }
          ListEmptyComponent={<Empty label={search ? 'No matches.' : 'No companies yet.'} />}
          renderItem={({ item }) => (
            <Pressable
              style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              onPress={() => openEdit(item)}
            >
              <View style={styles.avatar}>
                <Icon name="company" size={20} color={colors.textMuted} />
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.name}>{item.name}</Text>
                {item.domain ? <Text style={styles.sub}>{item.domain}</Text> : null}
                {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
                <View style={styles.relRow}>
                  <Icon name="person" size={13} color={colors.textSubtle} />
                  <Text style={styles.rel} numberOfLines={3}>
                    {item.contacts.length ? item.contacts.map((p) => p.name).join(', ') : 'No contact people'}
                  </Text>
                </View>
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        onPress={openCreate}
        accessibilityRole="button"
        accessibilityLabel={tab === 'people' ? 'New person' : 'New company'}
      >
        <Icon name="add" size={28} color={colors.white} />
      </Pressable>

      <ContactFormModal
        visible={formOpen}
        kind={tab === 'people' ? 'person' : 'company'}
        editing={editing}
        onClose={() => setFormOpen(false)}
      />
    </View>
  );
}

function Segment({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.segBtn, active && styles.segBtnActive]} onPress={onPress}>
      <Text style={[styles.segText, active && styles.segTextActive]}>{label}</Text>
    </Pressable>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  top: {
    padding: space.md,
    paddingBottom: space.sm,
    gap: space.sm,
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  segment: { flexDirection: 'row', gap: space.sm },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    backgroundColor: colors.surface,
  },
  segBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  segText: { fontFamily: fonts.semibold, fontSize: fontSize.md, color: colors.textMuted },
  segTextActive: { color: colors.white },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
  },
  search: {
    flex: 1,
    paddingVertical: 10,
    fontSize: fontSize.md,
    fontFamily: fonts.regular,
    color: colors.ink,
  },
  list: { padding: space.md, gap: space.sm },
  grow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.lg },
  card: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    ...shadow.card,
  },
  cardPressed: { opacity: 0.6 },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { flex: 1, gap: 3 },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  relRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs + 1, marginTop: space.xs + 1 },
  rel: { fontFamily: fonts.medium, fontSize: fontSize.sm, color: colors.textMuted, flexShrink: 1 },
  muted: { fontFamily: fonts.regular, fontSize: fontSize.md, color: colors.textSubtle },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.raised,
  },
  fabPressed: { opacity: 0.85 },
});
