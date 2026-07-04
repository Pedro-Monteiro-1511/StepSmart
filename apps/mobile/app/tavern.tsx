import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { Card } from '@/components/Card';
import { TavernApi } from '@/lib/endpoints';
import type { TavernOfferResponse } from '@stepsmart/shared-types';

export default function TavernScreen() {
  const [data, setData] = useState<TavernOfferResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const result = await TavernApi.quests();
    setData(result);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    tickRef.current = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, []);

  useEffect(() => {
    if (data?.current?.status === 'IN_PROGRESS' && new Date(data.current.endsAt).getTime() <= now) {
      load();
    }
  }, [now, data, load]);

  async function start(tavernQuestId: string) {
    setBusy(true);
    try {
      await TavernApi.start(tavernQuestId);
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível iniciar', err?.response?.data?.message ?? 'Tenta novamente.');
    } finally {
      setBusy(false);
    }
  }

  async function claim(userTavernQuestId: string) {
    setBusy(true);
    try {
      await TavernApi.claim(userTavernQuestId);
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível reclamar', err?.response?.data?.message ?? 'Tenta novamente.');
    } finally {
      setBusy(false);
    }
  }

  if (loading || !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const current = data.current;
  const remainingMs = current ? new Date(current.endsAt).getTime() - now : 0;
  const remainingLabel = formatRemaining(remainingMs);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      {current && current.status !== 'CLAIMED' ? (
        <Card>
          <Text style={styles.name}>{current.tavernQuest.title}</Text>
          <Text style={styles.label}>{current.tavernQuest.description}</Text>
          {current.status === 'IN_PROGRESS' ? (
            <Text style={styles.timer}>Regressa em {remainingLabel}</Text>
          ) : (
            <>
              <Text style={styles.narrative}>{current.resultPayload?.narrative}</Text>
              <Text style={styles.reward}>
                +{current.tavernQuest.rewardPayload.xp} XP · +{current.tavernQuest.rewardPayload.coins} coins
              </Text>
              <Pressable style={styles.actionButton} onPress={() => claim(current.id)} disabled={busy}>
                <Text style={styles.actionButtonText}>Reclamar recompensa</Text>
              </Pressable>
            </>
          )}
        </Card>
      ) : (
        <>
          <Text style={styles.sectionTitle}>Missões disponíveis</Text>
          {data.offered.map((quest) => (
            <Card key={quest.id}>
              <Text style={styles.name}>{quest.title}</Text>
              <Text style={styles.label}>{quest.description}</Text>
              <Text style={styles.label}>Duração: {quest.durationMinutes} min</Text>
              <Text style={styles.reward}>
                +{quest.rewardPayload.xp} XP · +{quest.rewardPayload.coins} coins
              </Text>
              <Pressable style={styles.actionButton} onPress={() => start(quest.id)} disabled={busy}>
                <Text style={styles.actionButtonText}>
                  {quest.costCoins > 0 ? `Iniciar (${quest.costCoins} coins)` : 'Iniciar (grátis)'}
                </Text>
              </Pressable>
            </Card>
          ))}
        </>
      )}
    </ScrollView>
  );
}

function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const hours = Math.floor(minutes / 60);
  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  }
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { color: '#94a3b8', marginTop: 4 },
  reward: { color: '#fbbf24', marginTop: 8, fontSize: 13 },
  narrative: { color: '#cbd5e1', marginTop: 10, fontStyle: 'italic' },
  timer: { color: '#38bdf8', marginTop: 10, fontSize: 15, fontWeight: '700' },
  actionButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  actionButtonText: { color: '#0f172a', fontWeight: '700' },
});
