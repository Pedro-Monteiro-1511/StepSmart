import { View, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { CharacterSummary } from '@stepsmart/shared-types';
import type { EquipmentSlot } from '@stepsmart/game-config';

/**
 * Shakes & Fidget-style equipment display: a fixed body silhouette with equipment slots
 * always in the same screen position. There's no real character art yet, so the "body" is
 * a simple silhouette shape and each slot is an icon badge — swapping in real sprites later
 * only touches this file.
 */
const SLOT_ICONS: Record<EquipmentSlot, keyof typeof Ionicons.glyphMap> = {
  head: 'skull-outline',
  body: 'shirt-outline',
  weapon: 'flash-outline',
  shield: 'shield-outline',
  pet: 'paw-outline',
  title: 'ribbon-outline',
  aura: 'sparkles-outline',
};

interface Props {
  equipped: CharacterSummary['equipped'];
  onSlotPress: (slot: EquipmentSlot) => void;
}

export function CharacterSilhouette({ equipped, onSlotPress }: Props) {
  const isEquipped = (slot: EquipmentSlot) => Boolean(equipped[slot]);

  return (
    <View style={styles.stage}>
      {isEquipped('aura') && <View style={styles.auraGlow} />}

      <View style={styles.headShape} />
      <View style={styles.bodyShape} />

      <SlotBadge slot="head" style={styles.slotHead} equipped={isEquipped('head')} onPress={onSlotPress} />
      <SlotBadge slot="weapon" style={styles.slotWeapon} equipped={isEquipped('weapon')} onPress={onSlotPress} />
      <SlotBadge slot="shield" style={styles.slotShield} equipped={isEquipped('shield')} onPress={onSlotPress} />
      <SlotBadge slot="body" style={styles.slotBody} equipped={isEquipped('body')} onPress={onSlotPress} />
      <SlotBadge slot="pet" style={styles.slotPet} equipped={isEquipped('pet')} onPress={onSlotPress} />
    </View>
  );
}

function SlotBadge({
  slot,
  style,
  equipped,
  onPress,
}: {
  slot: EquipmentSlot;
  style: object;
  equipped: boolean;
  onPress: (slot: EquipmentSlot) => void;
}) {
  return (
    <Pressable style={[styles.slotBadge, style, equipped && styles.slotBadgeEquipped]} onPress={() => onPress(slot)}>
      <Ionicons name={SLOT_ICONS[slot]} size={20} color={equipped ? '#fbbf24' : '#64748b'} />
    </Pressable>
  );
}

const STAGE_SIZE = 220;

const styles = StyleSheet.create({
  stage: {
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    alignSelf: 'center',
    marginVertical: 8,
  },
  auraGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: STAGE_SIZE,
    height: STAGE_SIZE,
    borderRadius: STAGE_SIZE / 2,
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
  },
  headShape: {
    position: 'absolute',
    top: 26,
    left: STAGE_SIZE / 2 - 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#334155',
  },
  bodyShape: {
    position: 'absolute',
    top: 80,
    left: STAGE_SIZE / 2 - 45,
    width: 90,
    height: 110,
    borderTopLeftRadius: 40,
    borderTopRightRadius: 40,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    backgroundColor: '#334155',
  },
  slotBadge: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1e293b',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotBadgeEquipped: {
    borderColor: '#fbbf24',
  },
  slotHead: { top: 0, left: STAGE_SIZE / 2 - 20 },
  slotWeapon: { top: 110, left: STAGE_SIZE / 2 + 60 },
  slotShield: { top: 110, left: STAGE_SIZE / 2 - 100 },
  slotBody: { top: 130, left: STAGE_SIZE / 2 - 20 },
  slotPet: { top: 180, left: STAGE_SIZE / 2 + 60 },
});
