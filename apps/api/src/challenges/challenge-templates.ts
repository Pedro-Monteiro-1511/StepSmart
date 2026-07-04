/**
 * Static catalog backing daily challenge generation. `paramsFactory` produces the
 * per-day params (target/deadline/window) — kept simple/deterministic-ish for MVP;
 * a later pass can randomize/scale targets by player level or history.
 */
export interface ChallengeTemplateDef {
  challengeType: string;
  title: string;
  description: string;
  isMandatory: boolean;
  paramsFactory: () => Record<string, unknown>;
  rewardFactory: (difficulty: string) => { xp: number; coins: number };
}

export const MANDATORY_TEMPLATE: ChallengeTemplateDef = {
  challengeType: 'timed_steps',
  title: 'Faz 3000 passos até às 12:00',
  description: 'Anda 3000 passos antes do meio-dia (hora local).',
  isMandatory: true,
  paramsFactory: () => ({ target: 3000, deadline: '12:00' }),
  rewardFactory: () => ({ xp: 60, coins: 20 }),
};

/** Pool of optional daily challenges — 2 are drawn from here alongside the mandatory one. */
export const OPTIONAL_TEMPLATES: ChallengeTemplateDef[] = [
  {
    challengeType: 'daily_steps',
    title: 'Faz 8000 passos hoje',
    description: 'Atinge 8000 passos até ao fim do dia.',
    isMandatory: false,
    paramsFactory: () => ({ target: 8000 }),
    rewardFactory: () => ({ xp: 80, coins: 30 }),
  },
  {
    challengeType: 'early_bird',
    title: 'Madrugador: 2000 passos até às 09:00',
    description: 'Começa o dia cedo — 2000 passos antes das 09:00.',
    isMandatory: false,
    paramsFactory: () => ({ target: 2000, deadline: '09:00' }),
    rewardFactory: () => ({ xp: 50, coins: 15 }),
  },
  {
    challengeType: 'time_window',
    title: 'Passeio a tarde: 2500 passos entre as 14:00 e as 18:00',
    description: 'Caminha 2500 passos na janela da tarde.',
    isMandatory: false,
    paramsFactory: () => ({ target: 2500, windowStart: '14:00', windowEnd: '18:00' }),
    rewardFactory: () => ({ xp: 55, coins: 18 }),
  },
  {
    challengeType: 'streak',
    title: 'Mantém a streak: 3 dias seguidos',
    description: 'Mantém-te ativo 3 dias consecutivos.',
    isMandatory: false,
    paramsFactory: () => ({ target: 3 }),
    rewardFactory: () => ({ xp: 100, coins: 40 }),
  },
  {
    challengeType: 'beat_pr',
    title: 'Bate o teu recorde pessoal',
    description: 'Supera o teu recorde pessoal de passos num dia.',
    isMandatory: false,
    paramsFactory: () => ({}), // target resolved per-user at generation time (personal best)
    rewardFactory: () => ({ xp: 120, coins: 50 }),
  },
];

export const ALL_TEMPLATES = [MANDATORY_TEMPLATE, ...OPTIONAL_TEMPLATES];
