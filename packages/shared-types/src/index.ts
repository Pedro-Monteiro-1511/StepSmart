import type { EquipmentSlot, SkillKey } from '@stepsmart/game-config';

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

export interface PublicUser {
  id: string;
  email: string;
  username: string;
  timezone: string;
}

export interface StepBucketInput {
  bucketStart: string; // ISO datetime
  bucketEnd: string; // ISO datetime
  steps: number;
  distanceMeters?: number;
  activeEnergy?: number;
  source: string; // 'healthkit' | 'health_connect' | 'manual' | 'mock'
  isManual?: boolean;
}

export interface StepSyncRequest {
  buckets: StepBucketInput[];
  clientBatchId: string;
}

export interface EquippedItemSummary {
  inventoryId: string;
  item: ShopItemSummary;
}

export interface CharacterSummary {
  id: string;
  name: string;
  level: number;
  xp: number; // progress within current level (not lifetime total)
  xpToNext: number;
  skillPoints: number;
  stats: Record<SkillKey, number>;
  equipped: Partial<Record<EquipmentSlot, EquippedItemSummary>>;
}

export type ChallengeStatus = 'ACTIVE' | 'COMPLETED' | 'FAILED';

export interface DailyChallengeDefinition {
  id: string;
  date: string;
  challengeType: string;
  title: string;
  params: Record<string, unknown>;
  difficulty: string;
  rewardPayload: { xp: number; coins: number };
  isMandatory: boolean;
  createdAt: string;
}

export interface UserDailyChallengeSummary {
  id: string;
  userId: string;
  dailyChallengeId: string;
  date: string;
  progress: number;
  target: number;
  status: ChallengeStatus;
  completedAt: string | null;
  rewardClaimed: boolean;
  dailyChallenge: DailyChallengeDefinition;
}

export interface StepSyncResult {
  stepsToday: number;
  coinsCredited: number;
  xpCredited: number;
  walletBalance: number;
  character: CharacterSummary;
  challenges: UserDailyChallengeSummary[];
}

export type ItemEffectType = 'COSMETIC' | 'BOOST' | 'CONSUMABLE';

export interface ShopItemSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  effectType: ItemEffectType;
  effectPayload: Record<string, unknown> | null;
  rarity: string;
  priceCoins: number;
  slot: string | null;
  minLevel: number;
  isActive: boolean;
  assetUrl: string | null;
}

export interface InventoryItemSummary {
  id: string;
  userId: string;
  itemId: string;
  quantity: number;
  equipped: boolean;
  acquiredAt: string;
  item: ShopItemSummary;
}

export interface WalletSummary {
  id: string;
  userId: string;
  coinsBalance: number;
  coinsLifetime: number;
  updatedAt: string;
}

export interface LeaderboardEntry {
  subjectId: string;
  score: number;
  rank: number;
}

export interface LeaderboardResponse {
  metric: string;
  window: string;
  period: string;
  entries: LeaderboardEntry[];
}

export interface DungeonSummary {
  id: string;
  key: string;
  name: string;
  description: string;
  minLevel: number;
  difficulty: number;
  xpRewardWin: number;
  xpRewardLose: number;
  coinsRewardWin: number;
}

export interface DungeonStateSummary {
  attemptsAvailable: number;
  maxAttempts: number;
  lastRegenAt: string;
  extraAttemptsBoughtToday: number;
}

export interface DungeonRunResult {
  run: {
    id: string;
    result: 'WIN' | 'LOSE';
    combatLog: string[];
    xpGained: number;
    coinsGained: number;
    createdAt: string;
  };
  lootItem: ShopItemSummary | null;
  attemptsAvailable: number;
}

export interface TavernQuestSummary {
  id: string;
  key: string;
  title: string;
  description: string;
  durationMinutes: number;
  minLevel: number;
  costCoins: number;
  rewardPayload: { xp: number; coins: number };
}

export type UserTavernQuestStatus = 'IN_PROGRESS' | 'COMPLETED' | 'CLAIMED';

export interface UserTavernQuestSummary {
  id: string;
  userId: string;
  tavernQuestId: string;
  startedAt: string;
  endsAt: string;
  status: UserTavernQuestStatus;
  resultPayload: { narrative: string } | null;
  tavernQuest: TavernQuestSummary;
}

export interface TavernOfferResponse {
  offered: TavernQuestSummary[];
  current: UserTavernQuestSummary | null;
}
