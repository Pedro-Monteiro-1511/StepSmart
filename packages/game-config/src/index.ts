/**
 * Central economy/progression constants.
 * Single source of truth shared by API and (eventually) mobile display logic.
 * Tune these instead of hardcoding numbers across modules.
 */

export const ECONOMY = {
  STEPS_PER_COIN: 100, // 100 steps = 1 coin
  XP_PER_STEP: 0.1, // 10 steps = 1 XP
  DAILY_STEP_CAP: 30_000, // steps/day that count towards economy
  DAILY_COIN_CAP: 300, // max coins credited per day
  CHALLENGES_PER_DAY: 3,
  SKILL_POINTS_PER_LEVEL: 1,
  STREAK_FREEZE_MAX: 1,
} as const;

/** XP required to go from `level` to `level + 1`. */
export function xpForLevel(level: number): number {
  return Math.round(100 * Math.pow(level, 1.5));
}

/** Given total accumulated XP, resolve the resulting level and XP progress into it. */
export function resolveLevelFromXp(totalXp: number): {
  level: number;
  xpIntoLevel: number;
  xpToNext: number;
} {
  let level = 1;
  let remaining = totalXp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpToNext: xpForLevel(level) };
}

export const SKILL_KEYS = [
  'stamina',
  'strength',
  'agility',
  'endurance',
  'luck',
  'discipline',
] as const;

export type SkillKey = (typeof SKILL_KEYS)[number];

/** Cost in skill points to go from `currentLevel` to `currentLevel + 1` for a skill. */
export function skillUpgradeCost(currentLevel: number): number {
  return currentLevel + 1;
}

export const CHALLENGE_TYPES = [
  'daily_steps',
  'timed_steps',
  'time_window',
  'multi_period',
  'streak',
  'beat_pr',
  'clan_contribution',
  'flawless',
  'early_bird',
  'consistency',
] as const;

export type ChallengeType = (typeof CHALLENGE_TYPES)[number];

/** Every day, one of the 3 daily challenges must be of this type (e.g. "3000 steps by 12:00"). */
export const MANDATORY_CHALLENGE_TYPE: ChallengeType = 'timed_steps';

export const EQUIPMENT_SLOTS = ['head', 'body', 'weapon', 'shield', 'pet', 'title', 'aura'] as const;

export type EquipmentSlot = (typeof EQUIPMENT_SLOTS)[number];

/** Dungeons (§9 of PLANO_TECNICO.md) — idle/simulated combat, resolved instantly server-side. */
export const DUNGEON = {
  BASE_ATTEMPTS: 3, // + 1 per Stamina level
  ATTEMPT_REGEN_MINUTES: 30,
  EXTRA_ATTEMPT_COST_BASE: 20, // coins; doubles per extra purchase the same day
} as const;

/** Tavern (§10) — rotating, time-based quests unrelated to real steps. */
export const TAVERN = {
  QUEST_SLOTS: 3,
  QUEST_REFRESH_HOURS: 8,
} as const;

export function maxDungeonAttempts(staminaLevel: number): number {
  return DUNGEON.BASE_ATTEMPTS + staminaLevel;
}

/** Coins cost of the Nth extra attempt bought today (0-indexed: first extra purchase = N=0). */
export function extraAttemptCost(attemptsBoughtToday: number): number {
  return DUNGEON.EXTRA_ATTEMPT_COST_BASE * Math.pow(2, attemptsBoughtToday);
}

/** Character combat power for dungeon resolution — driven by Strength/Agility/Endurance. */
export function combatPower(stats: { strength: number; agility: number; endurance: number }): number {
  return stats.strength * 3 + stats.agility * 2 + stats.endurance * 2;
}

/** Win chance for a dungeon run, clamped so neither side is ever a guaranteed outcome. */
export function dungeonWinChance(characterPower: number, dungeonDifficulty: number): number {
  const raw = characterPower / (characterPower + dungeonDifficulty);
  return Math.min(0.95, Math.max(0.15, raw));
}
