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
import { useCompanies, usePersons } from '@/lib/api/contacts';
import type { ApiCompany, ApiPerson } from '@/lib/api/types';
import { colors, fonts, fontSize, radius, space } from '@/theme';

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
        <TextInput
          style={styles.search}
          placeholder={tab === 'people' ? 'Search people…' : 'Search companies…'}
          placeholderTextColor={colors.textSubtle}
          value={search}
          onChangeText={setSearch}
          autoCorrect={false}
        />
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
            <Pressable style={styles.card} onPress={() => openEdit(item)}>
              <Text style={styles.name}>{item.name}</Text>
              {item.email ? <Text style={styles.sub}>{item.email}</Text> : null}
              {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
              {item.companies.length > 0 ? (
                <Text style={styles.tag}>{item.companies.map((c) => c.name).join(', ')}</Text>
              ) : null}
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
            <Pressable style={styles.card} onPress={() => openEdit(item)}>
              <Text style={styles.name}>{item.name}</Text>
              {item.domain ? <Text style={styles.sub}>{item.domain}</Text> : null}
              {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
              {item.contacts.length > 0 ? (
                <Text style={styles.tag}>{item.contacts.map((p) => p.name).join(', ')}</Text>
              ) : null}
            </Pressable>
          )}
        />
      )}

      <Pressable style={styles.fab} onPress={openCreate}>
        <Text style={styles.fabText}>＋</Text>
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
  screen: { flex: 1, backgroundColor: colors.bg },
  top: { padding: space.md, paddingBottom: space.sm, gap: space.sm },
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
  },
  list: { paddingHorizontal: space.md, paddingBottom: space.md, gap: 10 },
  grow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: space.lg },
  card: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.xl,
    padding: space.md,
    gap: 3,
  },
  name: { fontFamily: fonts.semibold, fontSize: fontSize.lg, color: colors.ink },
  sub: { fontFamily: fonts.regular, fontSize: fontSize.sm, color: colors.textMuted },
  tag: { fontFamily: fonts.medium, fontSize: fontSize.xs, color: colors.primary, marginTop: space.xs },
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
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  fabText: { color: colors.white, fontSize: 30, lineHeight: 34 },
});
