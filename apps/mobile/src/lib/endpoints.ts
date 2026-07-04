import { api } from './api';
import type {
  AuthResponse,
  CharacterSummary,
  DungeonRunResult,
  DungeonStateSummary,
  DungeonSummary,
  InventoryItemSummary,
  LeaderboardResponse,
  PublicUser,
  ShopItemSummary,
  StepSyncRequest,
  StepSyncResult,
  TavernOfferResponse,
  UserDailyChallengeSummary,
  UserTavernQuestSummary,
  WalletSummary,
} from '@stepsmart/shared-types';

export const AuthApi = {
  register: (body: { email: string; username: string; password: string; timezone: string }) =>
    api.post<AuthResponse>('/auth/register', body).then((r) => r.data),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/auth/login', body).then((r) => r.data),
  me: () => api.get<PublicUser>('/auth/me').then((r) => r.data),
};

export const CharacterApi = {
  getMine: () => api.get<CharacterSummary>('/character').then((r) => r.data),
  upgradeSkill: (skillKey: string) =>
    api.post<CharacterSummary>(`/character/skills/${skillKey}/upgrade`).then((r) => r.data),
};

export const WalletApi = {
  getWallet: () => api.get<WalletSummary>('/wallet').then((r) => r.data),
  getTransactions: () => api.get('/wallet/transactions').then((r) => r.data),
};

export const StepsApi = {
  sync: (body: StepSyncRequest) => api.post<StepSyncResult>('/steps/sync', body).then((r) => r.data),
  today: () => api.get<{ date: string; steps: number }>('/steps/today').then((r) => r.data),
};

export const ShopApi = {
  listItems: () => api.get<ShopItemSummary[]>('/shop/items').then((r) => r.data),
  purchase: (itemId: string) => api.post('/shop/purchase', { itemId }).then((r) => r.data),
  listInventory: () => api.get<InventoryItemSummary[]>('/inventory').then((r) => r.data),
  equip: (inventoryId: string) => api.post(`/inventory/${inventoryId}/equip`).then((r) => r.data),
  unequip: (inventoryId: string) => api.post(`/inventory/${inventoryId}/unequip`).then((r) => r.data),
};

export const ChallengesApi = {
  today: () => api.get<UserDailyChallengeSummary[]>('/challenges/today').then((r) => r.data),
  claim: (id: string) => api.post(`/challenges/${id}/claim`).then((r) => r.data),
};

export type LeaderboardMetric = 'steps' | 'xp';
export type LeaderboardWindow = 'daily' | 'weekly' | 'monthly' | 'all_time';

export const LeaderboardsApi = {
  top: (metric: LeaderboardMetric, window: LeaderboardWindow) =>
    api.get<LeaderboardResponse>(`/leaderboards?metric=${metric}&window=${window}`).then((r) => r.data),
  mine: (metric: LeaderboardMetric, window: LeaderboardWindow) =>
    api
      .get<{ rank: number | null; score: number }>(`/leaderboards/me?metric=${metric}&window=${window}`)
      .then((r) => r.data),
};

export const DungeonsApi = {
  catalog: () => api.get<DungeonSummary[]>('/dungeons').then((r) => r.data),
  state: () => api.get<DungeonStateSummary>('/dungeons/state').then((r) => r.data),
  enter: (dungeonId: string) => api.post<DungeonRunResult>(`/dungeons/${dungeonId}/enter`).then((r) => r.data),
  buyAttempt: () =>
    api.post<{ attemptsAvailable: number; costPaid: number }>('/dungeons/state/buy-attempt').then((r) => r.data),
};

export const TavernApi = {
  quests: () => api.get<TavernOfferResponse>('/tavern/quests').then((r) => r.data),
  start: (tavernQuestId: string) =>
    api.post<UserTavernQuestSummary>(`/tavern/quests/${tavernQuestId}/start`).then((r) => r.data),
  claim: (userTavernQuestId: string) =>
    api.post<UserTavernQuestSummary>(`/tavern/quests/${userTavernQuestId}/claim`).then((r) => r.data),
};
