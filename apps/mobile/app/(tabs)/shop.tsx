import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Card } from '@/components/Card';
import { ShopApi } from '@/lib/endpoints';
import type { InventoryItemSummary, ShopItemSummary } from '@stepsmart/shared-types';

export default function ShopScreen() {
  const params = useLocalSearchParams<{ tab?: string; slot?: string }>();
  const [tab, setTab] = useState<'shop' | 'inventory'>(params.tab === 'inventory' ? 'inventory' : 'shop');
  const [slotFilter, setSlotFilter] = useState<string | undefined>(params.slot);
  const [items, setItems] = useState<ShopItemSummary[]>([]);
  const [inventory, setInventory] = useState<InventoryItemSummary[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [shopItems, inv] = await Promise.all([ShopApi.listItems(), ShopApi.listInventory()]);
    setItems(shopItems);
    setInventory(inv);
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  useEffect(() => {
    if (params.tab === 'inventory') setTab('inventory');
    setSlotFilter(params.slot);
  }, [params.tab, params.slot]);

  const visibleInventory = slotFilter ? inventory.filter((entry) => entry.item.slot === slotFilter) : inventory;

  async function purchase(itemId: string) {
    try {
      await ShopApi.purchase(itemId);
      await load();
      Alert.alert('Compra concluída', 'Item adicionado ao inventário.');
    } catch (err: any) {
      Alert.alert('Compra falhou', err?.response?.data?.message ?? 'Tenta novamente.');
    }
  }

  async function toggleEquip(entry: InventoryItemSummary) {
    try {
      if (entry.equipped) {
        await ShopApi.unequip(entry.id);
      } else {
        await ShopApi.equip(entry.id);
      }
      await load();
    } catch (err: any) {
      Alert.alert('Ação falhou', err?.response?.data?.message ?? 'Tenta novamente.');
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
      <View style={styles.tabBar}>
        <Pressable style={[styles.tabButton, tab === 'shop' && styles.tabButtonActive]} onPress={() => setTab('shop')}>
          <Text style={styles.tabButtonText}>Loja</Text>
        </Pressable>
        <Pressable
          style={[styles.tabButton, tab === 'inventory' && styles.tabButtonActive]}
          onPress={() => setTab('inventory')}
        >
          <Text style={styles.tabButtonText}>Inventário</Text>
        </Pressable>
      </View>

      {tab === 'inventory' && slotFilter && (
        <Pressable style={styles.filterBanner} onPress={() => setSlotFilter(undefined)}>
          <Text style={styles.filterBannerText}>A filtrar por slot: {slotFilter} · toca para limpar</Text>
        </Pressable>
      )}

      <ScrollView contentContainerStyle={{ padding: 16 }}>
        {tab === 'shop'
          ? items.map((item) => (
              <Card key={item.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{item.name}</Text>
                  <Text style={styles.label}>{item.description}</Text>
                  <Text style={styles.badge}>
                    {item.effectType} · {item.rarity}
                  </Text>
                </View>
                <Pressable style={styles.buyButton} onPress={() => purchase(item.id)}>
                  <Text style={styles.buyButtonText}>{item.priceCoins} coins</Text>
                </Pressable>
              </Card>
            ))
          : visibleInventory.map((entry) => (
              <Card key={entry.id} style={styles.itemRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemName}>{entry.item.name}</Text>
                  <Text style={styles.label}>Quantidade: {entry.quantity}</Text>
                </View>
                {entry.item.slot && (
                  <Pressable
                    style={[styles.buyButton, entry.equipped && styles.equippedButton]}
                    onPress={() => toggleEquip(entry)}
                  >
                    <Text style={styles.buyButtonText}>{entry.equipped ? 'Equipado' : 'Equipar'}</Text>
                  </Pressable>
                )}
              </Card>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a' },
  tabBar: { flexDirection: 'row', gap: 8, padding: 16, paddingBottom: 0 },
  tabButton: { flex: 1, paddingVertical: 10, borderRadius: 8, backgroundColor: '#1e293b', alignItems: 'center' },
  tabButtonActive: { backgroundColor: '#22c55e' },
  tabButtonText: { color: '#fff', fontWeight: '700' },
  filterBanner: { backgroundColor: '#334155', marginHorizontal: 16, marginTop: 12, padding: 10, borderRadius: 8 },
  filterBannerText: { color: '#fbbf24', fontSize: 12, textAlign: 'center' },
  itemRow: { flexDirection: 'row', alignItems: 'center' },
  itemName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  label: { color: '#94a3b8', marginTop: 2 },
  badge: { color: '#38bdf8', marginTop: 4, fontSize: 12, textTransform: 'uppercase' },
  buyButton: { backgroundColor: '#22c55e', borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12 },
  equippedButton: { backgroundColor: '#334155' },
  buyButtonText: { color: '#0f172a', fontWeight: '700' },
});
