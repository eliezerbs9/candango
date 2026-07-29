/**
 * Contacts tab — People and Companies, toggled by a segmented control.
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
import { colors, fonts, fontSize, radius, space } from '@/theme';

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
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : tab === 'people' ? (
        <FlatList
          data={persons.data ?? []}
          keyExtractor={(p) => p.id}
          contentContainerStyle={[styles.list, (persons.data ?? []).length === 0 && styles.grow]}
          refreshControl={
            <RefreshControl
              refreshing={persons.isRefetching}
              onRefresh={() => persons.refetch()}
              tintColor={colors.primary}
            />
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
            <RefreshControl
              refreshing={companies.isRefetching}
              onRefresh={() => companies.refetch()}
              tintColor={colors.primary}
            />
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
  screen: { flex: 1, backgroundColor: colors.bg },
  segment: { flexDirection: 'row', gap: space.sm, padding: space.md, paddingBottom: space.sm },
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
  retry: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  retryText: { fontFamily: fonts.semibold, color: colors.primary },
});
