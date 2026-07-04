import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { useAuth } from '@/lib/auth-context';
import { LeaderboardsApi, type LeaderboardMetric, type LeaderboardWindow } from '@/lib/endpoints';
import type { LeaderboardEntry } from '@stepsmart/shared-types';

const METRICS: LeaderboardMetric[] = ['steps', 'xp'];
const WINDOWS: LeaderboardWindow[] = ['daily', 'weekly', 'monthly', 'all_time'];

export default function LeaderboardScreen() {
  const { user } = useAuth();
  const [metric, setMetric] = useState<LeaderboardMetric>('steps');
  const [window, setWindowVal] = useState<LeaderboardWindow>('daily');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await LeaderboardsApi.top(metric, window);
    setEntries(data.entries);
    setLoading(false);
  }, [metric, window]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        {METRICS.map((m) => (
          <Pressable
            key={m}
            style={[styles.filterButton, metric === m && styles.filterButtonActive]}
            onPress={() => setMetric(m)}
          >
            <Text style={styles.filterText}>{m === 'steps' ? 'Passos' : 'XP'}</Text>
          </Pressable>
        ))}
      </View>
      <View style={styles.filterRow}>
        {WINDOWS.map((w) => (
          <Pressable
            key={w}
            style={[styles.filterButton, window === w && styles.filterButtonActive]}
            onPress={() => setWindowVal(w)}
          >
            <Text style={styles.filterText}>
              {{ daily: 'Diário', weekly: 'Semanal', monthly: 'Mensal', all_time: 'Total' }[w]}
            </Text>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.subjectId}
          contentContainerStyle={{ padding: 16 }}
          renderItem={({ item }) => (
            <View style={[styles.row, item.subjectId === user?.id && styles.rowMe]}>
              <Text style={styles.rank}>#{item.rank}</Text>
              <Text style={styles.subject}>{item.subjectId === user?.id ? 'Tu' : item.subjectId.slice(0, 8)}</Text>
              <Text style={styles.score}>{item.score.toLocaleString()}</Text>
            </View>
          )}
          ListEmptyComponent={<Text style={styles.empty}>Ainda sem dados para este período.</Text>}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  filterRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, paddingTop: 12 },
  filterButton: { flex: 1, paddingVertical: 8, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  filterButtonActive: { backgroundColor: '#22c55e' },
  filterText: { color: '#fff', fontWeight: '600', fontSize: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
  },
  rowMe: { borderWidth: 1, borderColor: '#22c55e' },
  rank: { color: '#94a3b8', width: 40, fontWeight: '700' },
  subject: { color: '#fff', flex: 1 },
  score: { color: '#fbbf24', fontWeight: '700' },
  empty: { color: '#94a3b8', textAlign: 'center', marginTop: 24 },
});
