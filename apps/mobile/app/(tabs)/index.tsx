import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/Card';
import { CharacterApi, ChallengesApi, WalletApi, StepsApi } from '@/lib/endpoints';
import { syncSteps } from '@/health';
import type { CharacterSummary, UserDailyChallengeSummary, WalletSummary } from '@stepsmart/shared-types';

export default function HomeScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [stepsToday, setStepsToday] = useState(0);
  const [challenges, setChallenges] = useState<UserDailyChallengeSummary[]>([]);

  const loadAll = useCallback(async () => {
    try {
      await syncSteps();
    } catch {
      // Sync failures shouldn't block viewing existing data — swallow and just refresh from server.
    }
    const [char, wal, today, todaysChallenges] = await Promise.all([
      CharacterApi.getMine(),
      WalletApi.getWallet(),
      StepsApi.today(),
      ChallengesApi.today(),
    ]);
    setCharacter(char);
    setWallet(wal);
    setStepsToday(today.steps);
    setChallenges(todaysChallenges);
  }, []);

  useEffect(() => {
    loadAll().finally(() => setLoading(false));
  }, [loadAll]);

  async function onRefresh() {
    setRefreshing(true);
    await loadAll();
    setRefreshing(false);
  }

  async function claim(id: string) {
    await ChallengesApi.claim(id);
    await loadAll();
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
      <Card>
        <Text style={styles.stepsValue}>{stepsToday.toLocaleString()}</Text>
        <Text style={styles.label}>passos hoje</Text>
      </Card>

      <View style={styles.row}>
        <Card style={styles.half}>
          <Text style={styles.metricValue}>{wallet?.coinsBalance ?? 0}</Text>
          <Text style={styles.label}>coins</Text>
        </Card>
        <Card style={styles.half}>
          <Text style={styles.metricValue}>Nv. {character?.level ?? 1}</Text>
          <Text style={styles.label}>
            {character?.xp ?? 0}/{character?.xpToNext ?? 100} XP
          </Text>
        </Card>
      </View>

      <View style={styles.row}>
        <Pressable style={styles.half} onPress={() => router.push('/dungeons')}>
          <Card style={styles.quickLink}>
            <Text style={styles.linkText}>⚔️ Masmorras</Text>
          </Card>
        </Pressable>
        <Pressable style={styles.half} onPress={() => router.push('/tavern')}>
          <Card style={styles.quickLink}>
            <Text style={styles.linkText}>🍺 Taverna</Text>
          </Card>
        </Pressable>
      </View>

      <Pressable onPress={() => router.push('/leaderboard')}>
        <Card style={styles.leaderboardLink}>
          <Text style={styles.linkText}>Ver leaderboards →</Text>
        </Card>
      </Pressable>

      <Text style={styles.sectionTitle}>Desafios de hoje</Text>
      {challenges.map((c) => {
        const pct = Math.min(100, Math.round((c.progress / c.target) * 100));
        return (
          <Card key={c.id}>
            <View style={styles.challengeHeader}>
              <Text style={styles.challengeTitle}>
                {c.dailyChallenge.isMandatory ? '⭐ ' : ''}
                {c.dailyChallenge.title}
              </Text>
              <Text style={styles.challengeStatus}>{c.status}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${pct}%` }]} />
            </View>
            <Text style={styles.label}>
              {c.progress}/{c.target}
            </Text>
            {c.status === 'COMPLETED' && !c.rewardClaimed && (
              <Pressable style={styles.claimButton} onPress={() => claim(c.id)}>
                <Text style={styles.claimButtonText}>
                  Resgatar +{c.dailyChallenge.rewardPayload.coins} coins / +{c.dailyChallenge.rewardPayload.xp} XP
                </Text>
              </Pressable>
            )}
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  row: { flexDirection: 'row', gap: 12 },
  half: { flex: 1 },
  stepsValue: { fontSize: 40, fontWeight: '800', color: '#fff', textAlign: 'center' },
  metricValue: { fontSize: 22, fontWeight: '700', color: '#fff', textAlign: 'center' },
  label: { color: '#94a3b8', textAlign: 'center', marginTop: 4 },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginTop: 8, marginBottom: 12 },
  challengeHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  challengeTitle: { color: '#fff', fontWeight: '600', flex: 1, marginRight: 8 },
  challengeStatus: { color: '#22c55e', fontWeight: '700', fontSize: 12 },
  progressTrack: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#22c55e' },
  claimButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  claimButtonText: { color: '#0f172a', fontWeight: '700' },
  leaderboardLink: { alignItems: 'center' },
  quickLink: { alignItems: 'center' },
  linkText: { color: '#38bdf8', fontWeight: '600' },
});
