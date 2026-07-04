import { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Card } from '@/components/Card';
import { useAuth } from '@/lib/auth-context';
import { syncSteps } from '@/health';

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [syncing, setSyncing] = useState(false);

  async function handleSync() {
    setSyncing(true);
    try {
      const result = await syncSteps();
      if (result) {
        Alert.alert('Sync concluído', `${result.stepsToday} passos hoje · +${result.coinsCredited} coins`);
      } else {
        Alert.alert('Sem novos passos', 'Não há passos novos desde o último sync.');
      }
    } catch (err: any) {
      Alert.alert('Sync falhou', err?.response?.data?.message ?? 'Tenta novamente.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View style={styles.container}>
      <Card>
        <Text style={styles.username}>{user?.username}</Text>
        <Text style={styles.label}>{user?.email}</Text>
        <Text style={styles.label}>Fuso horário: {user?.timezone}</Text>
      </Card>

      <Card>
        <Text style={styles.sectionLabel}>Fonte de passos</Text>
        <Text style={styles.label}>
          A usar dados simulados (mock). Numa build nativa, isto liga-se ao Apple Health / Health Connect.
        </Text>
        <Pressable style={styles.button} onPress={handleSync} disabled={syncing}>
          <Text style={styles.buttonText}>{syncing ? 'A sincronizar...' : 'Sincronizar passos agora'}</Text>
        </Pressable>
      </Card>

      <Pressable style={styles.logoutButton} onPress={logout}>
        <Text style={styles.logoutButtonText}>Terminar sessão</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a', padding: 16 },
  username: { color: '#fff', fontSize: 22, fontWeight: '800' },
  label: { color: '#94a3b8', marginTop: 4 },
  sectionLabel: { color: '#fff', fontWeight: '700', marginBottom: 6 },
  button: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 12, alignItems: 'center', marginTop: 12 },
  buttonText: { color: '#0f172a', fontWeight: '700' },
  logoutButton: { borderRadius: 8, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#f87171' },
  logoutButtonText: { color: '#f87171', fontWeight: '700' },
});
