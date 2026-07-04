import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { Card } from '@/components/Card';
import { ChallengesApi } from '@/lib/endpoints';
import type { UserDailyChallengeSummary } from '@stepsmart/shared-types';

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Em curso',
  COMPLETED: 'Concluído',
  FAILED: 'Falhado',
};

export default function ChallengesScreen() {
  const [challenges, setChallenges] = useState<UserDailyChallengeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    const data = await ChallengesApi.today();
    setChallenges(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  async function claim(id: string) {
    await ChallengesApi.claim(id);
    await load();
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {challenges.map((c) => {
        const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
        return (
          <Card key={c.id}>
            <View style={styles.header}>
              <Text style={styles.title}>
                {c.dailyChallenge.isMandatory ? '⭐ ' : ''}
                {c.dailyChallenge.title}
              </Text>
              <Text style={[styles.status, c.status === 'FAILED' && styles.statusFailed]}>
                {STATUS_LABEL[c.status]}
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.label}>
              {c.progress}/{c.target}
            </Text>
            <Text style={styles.reward}>
              Recompensa: {c.dailyChallenge.rewardPayload.coins} coins · {c.dailyChallenge.rewardPayload.xp} XP
            </Text>
            {c.status === 'COMPLETED' && !c.rewardClaimed && (
              <Pressable style={styles.claimButton} onPress={() => claim(c.id)}>
                <Text style={styles.claimButtonText}>Resgatar recompensa</Text>
              </Pressable>
            )}
            {c.rewardClaimed && <Text style={styles.claimedLabel}>Recompensa já resgatada</Text>}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  title: { color: '#fff', fontWeight: '600', flex: 1, marginRight: 8, fontSize: 15 },
  status: { color: '#22c55e', fontWeight: '700', fontSize: 12 },
  statusFailed: { color: '#f87171' },
  progressTrack: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#22c55e' },
  label: { color: '#94a3b8', marginTop: 4 },
  reward: { color: '#fbbf24', marginTop: 6, fontSize: 13 },
  claimButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  claimButtonText: { color: '#0f172a', fontWeight: '700' },
  claimedLabel: { color: '#64748b', marginTop: 8, fontStyle: 'italic', fontSize: 12 },
});
