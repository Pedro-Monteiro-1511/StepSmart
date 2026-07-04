# StepSmart

App mobile gamificada (RPG) onde os passos reais do utilizador são a currency do jogo. Ver [PLANO_TECNICO.md](PLANO_TECNICO.md) para a arquitetura completa, modelo de dados e roadmap.

Monorepo (npm workspaces):

```
apps/api      → Backend NestJS + Prisma (Postgres) + Redis
apps/mobile   → App Expo (React Native + Expo Router)
packages/game-config   → Constantes de economia/progressão partilhadas
packages/shared-types  → Tipos TypeScript partilhados entre api e mobile
```

## Setup local

### 1. Infra (Postgres + Redis)

```bash
docker compose up -d
```

Postgres fica exposto em `localhost:5433` (não 5432, para não colidir com um Postgres nativo já instalado). Redis em `localhost:6379`.

### 2. Instalar dependências

```bash
npm install
```

### 3. Backend

```bash
cp apps/api/.env.example apps/api/.env
npm run build:packages
cd apps/api
npx prisma migrate dev --name init
npx ts-node prisma/seed.ts
cd ../..
npm run api:dev
```

API fica em `http://localhost:3000`.

### 4. Mobile

```bash
cp apps/mobile/.env.example apps/mobile/.env
# edita EXPO_PUBLIC_API_URL para o IP da tua máquina na rede local
# (num telemóvel físico "localhost" aponta para o próprio telemóvel, não para o teu PC)
npm run mobile:start
```

Para testar rapidamente no browser (sem simulador): `cd apps/mobile && npx expo start --web`.

A app usa por defeito um `MockHealthProvider` ([src/health/mock-provider.ts](apps/mobile/src/health/mock-provider.ts)) que simula passos, para poderes testar todo o loop (sync → coins → XP → desafios) sem sensores reais. Substituir por HealthKit/Health Connect é uma questão de implementar `HealthProvider` ([src/health/types.ts](apps/mobile/src/health/types.ts)) e trocar `getHealthProvider()`.

## Notas

- O servidor é sempre a fonte de verdade da economia — o cliente só reporta passos brutos.
- `/steps/sync` é idempotente (buckets horários com chave determinística) — podes chamá-lo várias vezes por dia sem duplicar créditos.
- Regras de negócio detalhadas (conversão, anti-cheat, desafios, clãs, roadmap) estão em [PLANO_TECNICO.md](PLANO_TECNICO.md).
