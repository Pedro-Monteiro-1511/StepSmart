import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { Card } from '@/components/Card';
import { CharacterSilhouette } from '@/components/CharacterSilhouette';
import { CharacterApi } from '@/lib/endpoints';
import type { CharacterSummary } from '@stepsmart/shared-types';
import { SKILL_KEYS, skillUpgradeCost, type EquipmentSlot } from '@stepsmart/game-config';

const SKILL_LABELS: Record<string, string> = {
  stamina: 'Stamina',
  strength: 'Strength',
  agility: 'Agility',
  endurance: 'Endurance',
  luck: 'Luck',
  discipline: 'Discipline',
};

export default function CharacterScreen() {
  const router = useRouter();
  const [character, setCharacter] = useState<CharacterSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await CharacterApi.getMine();
    setCharacter(data);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  async function upgrade(skillKey: string) {
    try {
      const updated = await CharacterApi.upgradeSkill(skillKey);
      setCharacter(updated);
    } catch (err: any) {
      Alert.alert('Não foi possível melhorar', err?.response?.data?.message ?? 'Tenta novamente.');
    }
  }

  if (loading || !character) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  const pct = Math.round((character.xp / character.xpToNext) * 100);

  function goToSlot(slot: EquipmentSlot) {
    router.push({ pathname: '/shop', params: { tab: 'inventory', slot } });
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Card>
        <CharacterSilhouette equipped={character.equipped} onSlotPress={goToSlot} />
        <Text style={styles.name}>{character.name}</Text>
        {character.equipped.title && (
          <Text style={styles.title}>{character.equipped.title.item.name}</Text>
        )}
        <Text style={styles.level}>Nível {character.level}</Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${pct}%` }]} />
        </View>
        <Text style={styles.label}>
          {character.xp}/{character.xpToNext} XP
        </Text>
      </Card>

      <Card>
        <Text style={styles.skillPoints}>{character.skillPoints} pontos de skill disponíveis</Text>
      </Card>

      <Text style={styles.sectionTitle}>Skills</Text>
      {SKILL_KEYS.map((key) => {
        const level = character.stats[key] ?? 1;
        const cost = skillUpgradeCost(level);
        const canAfford = character.skillPoints >= cost;
        return (
          <Card key={key} style={styles.skillRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.skillName}>{SKILL_LABELS[key] ?? key}</Text>
              <Text style={styles.label}>Nível {level}</Text>
            </View>
            <Pressable
              style={[styles.upgradeButton, !canAfford && styles.upgradeButtonDisabled]}
              onPress={() => upgrade(key)}
              disabled={!canAfford}
            >
              <Text style={styles.upgradeButtonText}>+1 ({cost} pts)</Text>
            </Pressable>
          </Card>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  name: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center' },
  title: { color: '#fbbf24', textAlign: 'center', fontSize: 13, marginTop: 2 },
  level: { color: '#94a3b8', textAlign: 'center', marginBottom: 10, marginTop: 4 },
  label: { color: '#94a3b8', marginTop: 4 },
  progressTrack: { height: 8, backgroundColor: '#334155', borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: 8, backgroundColor: '#22c55e' },
  skillPoints: { color: '#fbbf24', fontWeight: '700', textAlign: 'center' },
  sectionTitle: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  skillRow: { flexDirection: 'row', alignItems: 'center' },
  skillName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  upgradeButton: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  upgradeButtonDisabled: { backgroundColor: '#334155' },
  upgradeButtonText: { color: '#0f172a', fontWeight: '700' },
});
