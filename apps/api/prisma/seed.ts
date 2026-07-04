import { PrismaClient, ItemEffectType } from '@prisma/client';

const prisma = new PrismaClient();

const ITEMS = [
  {
    key: 'title_wanderer',
    name: 'Título: Wanderer',
    description: 'O teu primeiro título — atribuído a quem começa a jornada.',
    category: 'title',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'common',
    priceCoins: 50,
    slot: 'title',
    minLevel: 1,
  },
  {
    key: 'outfit_starter_hoodie',
    name: 'Hoodie Casual',
    description: 'Roupa cosmética básica para o teu character.',
    category: 'clothing',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'common',
    priceCoins: 80,
    slot: 'body',
    minLevel: 1,
  },
  {
    key: 'armor_bronze_plate',
    name: 'Armadura de Bronze (cosmética)',
    description: 'Visual de armadura de bronze — puramente estético.',
    category: 'armor',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'uncommon',
    priceCoins: 200,
    slot: 'body',
    minLevel: 5,
  },
  {
    key: 'weapon_wooden_staff',
    name: 'Cajado de Madeira (cosmético)',
    description: 'Arma cosmética, sem efeito em gameplay.',
    category: 'weapon',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'common',
    priceCoins: 120,
    slot: 'weapon',
    minLevel: 1,
  },
  {
    key: 'pet_small_dog',
    name: 'Cão companheiro',
    description: 'Um pet cosmético que te acompanha.',
    category: 'pet',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'rare',
    priceCoins: 350,
    slot: 'pet',
    minLevel: 10,
  },
  {
    key: 'boost_double_coins_2h',
    name: 'Boost: Coins x2 (2h)',
    description: 'Duplica os coins ganhos por passos durante 2 horas.',
    category: 'boost',
    effectType: ItemEffectType.BOOST,
    effectPayload: { multiplier: 2, durationMinutes: 120, appliesTo: 'coins' },
    rarity: 'uncommon',
    priceCoins: 150,
    minLevel: 1,
  },
  {
    key: 'boost_double_xp_2h',
    name: 'Boost: XP x2 (2h)',
    description: 'Duplica o XP ganho por passos durante 2 horas.',
    category: 'boost',
    effectType: ItemEffectType.BOOST,
    effectPayload: { multiplier: 2, durationMinutes: 120, appliesTo: 'xp' },
    rarity: 'uncommon',
    priceCoins: 150,
    minLevel: 1,
  },
  {
    key: 'consumable_streak_freeze',
    name: 'Streak Freeze',
    description: 'Protege a tua streak se falhares um dia.',
    category: 'consumable',
    effectType: ItemEffectType.CONSUMABLE,
    effectPayload: { grants: 'streak_freeze', charges: 1 },
    rarity: 'rare',
    priceCoins: 100,
    minLevel: 1,
  },
  {
    key: 'shield_wooden_buckler',
    name: 'Escudo de Madeira (cosmético)',
    description: 'Escudo cosmético, sem efeito em gameplay.',
    category: 'shield',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'common',
    priceCoins: 90,
    slot: 'shield',
    minLevel: 1,
  },
  {
    key: 'shield_iron_kite',
    name: 'Escudo de Ferro (cosmético)',
    description: 'Escudo de ferro robusto — visual de masmorra.',
    category: 'shield',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'uncommon',
    priceCoins: 0, // dungeon-only loot, not purchasable
    isActive: false,
    slot: 'shield',
    minLevel: 5,
  },
  {
    key: 'title_dungeon_delver',
    name: 'Título: Dungeon Delver',
    description: 'Título raro — cai apenas em masmorras.',
    category: 'title',
    effectType: ItemEffectType.COSMETIC,
    rarity: 'rare',
    priceCoins: 0, // dungeon-only loot, not purchasable
    isActive: false,
    slot: 'title',
    minLevel: 1,
  },
];

const DUNGEONS = [
  {
    key: 'dungeon_forest_ruins',
    name: 'Ruínas da Floresta',
    description: 'Uma masmorra inicial, ideal para os primeiros níveis.',
    minLevel: 1,
    difficulty: 8,
    lootTable: [
      { itemKey: 'outfit_starter_hoodie', weight: 5 },
      { itemKey: 'weapon_wooden_staff', weight: 3 },
      { itemKey: 'shield_wooden_buckler', weight: 2 },
    ],
    xpRewardWin: 40,
    xpRewardLose: 10,
    coinsRewardWin: 15,
  },
  {
    key: 'dungeon_abandoned_mine',
    name: 'Mina Abandonada',
    description: 'Passagens escuras com inimigos mais resistentes.',
    minLevel: 5,
    difficulty: 16,
    lootTable: [
      { itemKey: 'armor_bronze_plate', weight: 4 },
      { itemKey: 'shield_iron_kite', weight: 2 },
      { itemKey: 'consumable_streak_freeze', weight: 3 },
    ],
    xpRewardWin: 90,
    xpRewardLose: 20,
    coinsRewardWin: 35,
  },
  {
    key: 'dungeon_sunken_crypt',
    name: 'Cripta Submersa',
    description: 'Masmorra avançada — só para characters bem preparados.',
    minLevel: 12,
    difficulty: 28,
    lootTable: [
      { itemKey: 'pet_small_dog', weight: 2 },
      { itemKey: 'title_dungeon_delver', weight: 1 },
      { itemKey: 'boost_double_coins_2h', weight: 4 },
    ],
    xpRewardWin: 180,
    xpRewardLose: 35,
    coinsRewardWin: 70,
  },
];

const TAVERN_QUESTS = [
  {
    key: 'tavern_short_errand',
    title: 'Recado rápido na vila',
    description: 'Uma missão curta e simples.',
    durationMinutes: 15,
    minLevel: 1,
    costCoins: 5,
    rewardPayload: { xp: 20, coins: 10 },
  },
  {
    key: 'tavern_escort_merchant',
    title: 'Escoltar um mercador',
    description: 'Acompanha um mercador até à cidade vizinha.',
    durationMinutes: 60,
    minLevel: 1,
    costCoins: 15,
    rewardPayload: { xp: 60, coins: 25 },
  },
  {
    key: 'tavern_clear_bandits',
    title: 'Limpar o acampamento de bandidos',
    description: 'Uma missão mais longa, mas com melhor recompensa.',
    durationMinutes: 180,
    minLevel: 5,
    costCoins: 30,
    rewardPayload: { xp: 150, coins: 60 },
  },
  {
    key: 'tavern_overnight_watch',
    title: 'Vigia noturna nas muralhas',
    description: 'Uma missão longa, ideal para deixar a correr durante a noite.',
    durationMinutes: 480,
    minLevel: 8,
    costCoins: 40,
    rewardPayload: { xp: 300, coins: 100 },
  },
  {
    key: 'tavern_free_odd_job',
    title: 'Biscate grátis na taberna',
    description: 'Sem custo, mas a recompensa é modesta.',
    durationMinutes: 30,
    minLevel: 1,
    costCoins: 0,
    rewardPayload: { xp: 25, coins: 5 },
  },
];

async function main() {
  for (const item of ITEMS) {
    await prisma.item.upsert({
      where: { key: item.key },
      create: item,
      update: item,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${ITEMS.length} shop items.`);

  for (const dungeon of DUNGEONS) {
    await prisma.dungeon.upsert({
      where: { key: dungeon.key },
      create: dungeon,
      update: dungeon,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${DUNGEONS.length} dungeons.`);

  for (const quest of TAVERN_QUESTS) {
    await prisma.tavernQuest.upsert({
      where: { key: quest.key },
      create: quest,
      update: quest,
    });
  }
  // eslint-disable-next-line no-console
  console.log(`Seeded ${TAVERN_QUESTS.length} tavern quests.`);
}

main()
  .catch((err) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
