import type { SkillKey } from '@stepsmart/game-config';

/**
 * Narrates a dungeon run as a short sequence of events, flavored by the stats that
 * actually drove the outcome (Strength/Agility/Endurance = combat power, Luck = crits).
 * Purely presentational — the win/loss and rewards are already decided before this runs.
 */
export function generateCombatLog(
  dungeonName: string,
  stats: Record<SkillKey, number>,
  result: 'WIN' | 'LOSE',
): string[] {
  const log: string[] = [`O teu personagem entra em ${dungeonName}...`];

  if (stats.agility >= 3) {
    log.push('Esquiva um ataque com agilidade.');
  }
  if (stats.strength >= 3) {
    log.push('Desfere um golpe pesado no inimigo.');
  }
  if (stats.endurance >= 3) {
    log.push('Aguenta um ataque forte sem vacilar.');
  }
  if (log.length === 1) {
    log.push('Troca golpes com o inimigo.');
  }

  if (result === 'WIN') {
    if (stats.luck >= 3) {
      log.push('Um golpe de sorte decide o combate!');
    }
    log.push('Vitória! O inimigo é derrotado.');
  } else {
    log.push('O personagem é derrotado e recua da masmorra.');
  }

  return log;
}
