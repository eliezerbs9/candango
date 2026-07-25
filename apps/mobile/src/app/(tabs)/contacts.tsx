/**
 * Contacts tab — People and Companies, toggled by a segmented control.
 * Read-first: shows name + email/phone (people) or domain/phone (companies).
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useCompanies, usePersons } from '@/lib/api/contacts';

type Tab = 'people' | 'companies';

export default function ContactsScreen() {
  const [tab, setTab] = useState<Tab>('people');
  const persons = usePersons();
  const companies = useCompanies();
  const active = tab === 'people' ? persons : companies;

  return (
    <View style={styles.screen}>
      <View style={styles.segment}>
        <Segment label="People" active={tab === 'people'} onPress={() => setTab('people')} />
        <Segment label="Companies" active={tab === 'companies'} onPress={() => setTab('companies')} />
      </View>

      {active.isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator />
        </View>
      ) : tab === 'people' ? (
        <FlatList
          data={persons.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, (persons.data ?? []).length === 0 && styles.grow]}
          refreshControl={
            <RefreshControl refreshing={persons.isRefetching} onRefresh={() => persons.refetch()} />
          }
          ListEmptyComponent={<Empty label="No people yet." onRefresh={() => persons.refetch()} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {item.email ? <Text style={styles.sub}>{item.email}</Text> : null}
              {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
              {item.companies.length > 0 ? (
                <Text style={styles.tag}>{item.companies.map((c) => c.name).join(', ')}</Text>
              ) : null}
            </View>
          )}
        />
      ) : (
        <FlatList
          data={companies.data ?? []}
          keyExtractor={(c) => c.id}
          contentContainerStyle={[styles.list, (companies.data ?? []).length === 0 && styles.grow]}
          refreshControl={
            <RefreshControl refreshing={companies.isRefetching} onRefresh={() => companies.refetch()} />
          }
          ListEmptyComponent={<Empty label="No companies yet." onRefresh={() => companies.refetch()} />}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.name}>{item.name}</Text>
              {item.domain ? <Text style={styles.sub}>{item.domain}</Text> : null}
              {item.phone ? <Text style={styles.sub}>{item.phone}</Text> : null}
              {item.contacts.length > 0 ? (
                <Text style={styles.tag}>{item.contacts.length} contact(s)</Text>
              ) : null}
            </View>
          )}
        />
      )}
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

function Empty({ label, onRefresh }: { label: string; onRefresh: () => void }) {
  return (
    <View style={styles.center}>
      <Text style={styles.muted}>{label}</Text>
      <Pressable style={styles.retry} onPress={onRefresh}>
        <Text style={styles.retryText}>Refresh</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  segment: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 8 },
  segBtn: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e4e4e7',
    alignItems: 'center',
    backgroundColor: '#fafafa',
  },
  segBtnActive: { backgroundColor: '#d9552c', borderColor: '#d9552c' },
  segText: { fontSize: 14, fontWeight: '600', color: '#52525b' },
  segTextActive: { color: '#fff' },
  list: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
  grow: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 24 },
  card: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 14,
    padding: 16,
    gap: 3,
  },
  name: { fontSize: 16, fontWeight: '600', color: '#18181b' },
  sub: { fontSize: 13, color: '#71717a' },
  tag: { fontSize: 12, color: '#d9552c', marginTop: 4 },
  muted: { fontSize: 14, color: '#a1a1aa' },
  retry: {
    borderWidth: 1,
    borderColor: '#e4e4e7',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryText: { color: '#2563eb', fontWeight: '600' },
});
