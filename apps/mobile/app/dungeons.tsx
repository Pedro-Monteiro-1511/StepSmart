import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert, Modal } from 'react-native';
import { Card } from '@/components/Card';
import { DungeonsApi } from '@/lib/endpoints';
import type { DungeonRunResult, DungeonStateSummary, DungeonSummary } from '@stepsmart/shared-types';

export default function DungeonsScreen() {
  const [dungeons, setDungeons] = useState<DungeonSummary[]>([]);
  const [state, setState] = useState<DungeonStateSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [entering, setEntering] = useState<string | null>(null);
  const [result, setResult] = useState<DungeonRunResult | null>(null);

  const load = useCallback(async () => {
    const [catalog, dungeonState] = await Promise.all([DungeonsApi.catalog(), DungeonsApi.state()]);
    setDungeons(catalog);
    setState(dungeonState);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function enter(dungeonId: string) {
    setEntering(dungeonId);
    try {
      const run = await DungeonsApi.enter(dungeonId);
      setResult(run);
      await load();
    } catch (err: any) {
      Alert.alert('Não foi possível entrar', err?.response?.data?.message ?? 'Tenta novamente.');
    } finally {
      setEntering(null);
    }
  }

  async function buyAttempt() {
    try {
      await DungeonsApi.buyAttempt();
      await load();
    } catch (err: any) {
      Alert.alert('Compra falhou', err?.response?.data?.message ?? 'Tenta novamente.');
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Card style={styles.attemptsCard}>
        <Text style={styles.attemptsText}>
          {state?.attemptsAvailable ?? 0}/{state?.maxAttempts ?? 0} tentativas
        </Text>
        <Pressable style={styles.buyButton} onPress={buyAttempt}>
          <Text style={styles.buyButtonText}>Comprar tentativa</Text>
        </Pressable>
      </Card>

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {dungeons.map((dungeon) => (
          <Card key={dungeon.id}>
            <Text style={styles.name}>{dungeon.name}</Text>
            <Text style={styles.label}>{dungeon.description}</Text>
            <Text style={styles.reward}>
              Vitória: +{dungeon.xpRewardWin} XP · +{dungeon.coinsRewardWin} coins
            </Text>
            <Pressable
              style={[styles.enterButton, (state?.attemptsAvailable ?? 0) <= 0 && styles.enterButtonDisabled]}
              onPress={() => enter(dungeon.id)}
              disabled={entering === dungeon.id || (state?.attemptsAvailable ?? 0) <= 0}
            >
              <Text style={styles.enterButtonText}>{entering === dungeon.id ? 'A entrar...' : 'Entrar'}</Text>
            </Pressable>
          </Card>
        ))}
      </ScrollView>

      <Modal visible={!!result} transparent animationType="fade" onRequestClose={() => setResult(null)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{result?.run.result === 'WIN' ? 'Vitória!' : 'Derrota'}</Text>
            {result?.run.combatLog.map((line, i) => (
              <Text key={i} style={styles.logLine}>
                {line}
              </Text>
            ))}
            <Text style={styles.reward}>
              +{result?.run.xpGained} XP · +{result?.run.coinsGained} coins
            </Text>
            {result?.lootItem && <Text style={styles.loot}>Loot: {result.lootItem.name}</Text>}
            <Pressable style={styles.closeButton} onPress={() => setResult(null)}>
              <Text style={styles.buyButtonText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  attemptsCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', margin: 16, marginBottom: 0 },
  attemptsText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  buyButton: { backgroundColor: '#334155', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  buyButtonText: { color: '#fff', fontWeight: '700' },
  name: { color: '#fff', fontSize: 16, fontWeight: '700' },
  label: { color: '#94a3b8', marginTop: 4 },
  reward: { color: '#fbbf24', marginTop: 8, fontSize: 13 },
  enterButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 10, marginTop: 10, alignItems: 'center' },
  enterButtonDisabled: { backgroundColor: '#334155' },
  enterButtonText: { color: '#0f172a', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center' },
  modalCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 20, width: '85%' },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 12, textAlign: 'center' },
  logLine: { color: '#cbd5e1', marginBottom: 4 },
  loot: { color: '#38bdf8', marginTop: 4 },
  closeButton: { backgroundColor: '#22c55e', borderRadius: 8, padding: 10, marginTop: 16, alignItems: 'center' },
});
