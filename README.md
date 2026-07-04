<div align="center">

# 🏃‍♂️ StepSmart

**Transforma passos reais numa economia de RPG — anda, ganha, evolui.**

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)
![React Native](https://img.shields.io/badge/React_Native-20232A?style=flat&logo=react&logoColor=61DAFB)
![Expo](https://img.shields.io/badge/Expo-000020?style=flat&logo=expo&logoColor=white)
![NestJS](https://img.shields.io/badge/NestJS-E0234E?style=flat&logo=nestjs&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-2D3748?style=flat&logo=prisma&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)

</div>

---

## Sobre o projeto

**StepSmart** é uma aplicação mobile gamificada que converte a atividade física real do utilizador — os passos dados no dia a dia — numa moeda de jogo, usada para evoluir um personagem de RPG. É um cruzamento entre uma app de fitness e um jogo estilo *Shakes & Fidget*: o personagem sobe de nível, melhora skills, equipa itens, entra em masmorras idle e envia-se em missões de taverna, tudo alimentado pelos passos reais de quem joga.

Este repositório contém uma implementação **full-stack completa e funcional**: backend em NestJS com PostgreSQL/Redis, e uma app mobile em React Native (Expo Router), organizados como monorepo. Foi construído como projeto pessoal para explorar arquitetura de produto real de ponta a ponta — desde o design da economia do jogo até à validação anti-fraude dos dados de saúde.

## ✨ Destaques

- **🚶 Passos como currency** — conversão configurável (100 passos = 1 coin), com caps diários e deteção de picos de passos fisicamente impossíveis.
- **🔁 Sync idempotente** — `/steps/sync` aceita reenvios sem duplicar créditos: os passos são agregados por *buckets* horários com chave determinística, e a moeda/XP é calculada a partir de totais cumulativos (nunca por soma de deltas).
- **🧙 Personagem RPG** — níveis, XP, 6 skills (Stamina, Strength, Agility, Endurance, Luck, Discipline) que afetam economia, masmorras e progressão — nunca combate real contra outros jogadores.
- **🗡️ Masmorras idle** — o personagem entra numa masmorra e o servidor resolve o combate instantaneamente, devolvendo um log narrado e loot, à semelhança do Shakes & Fidget. Tentativas regeneram com o tempo ou compram-se com coins.
- **🍺 Taverna** — missões rotativas baseadas em tempo (não em passos), com contador ao vivo e resolução automática.
- **🛡️ Equipamento visível** — silhueta do personagem com slots de equipamento (elmo, arma, escudo, armadura, pet, aura) sempre na mesma posição.
- **🛒 Loja & inventário** — itens cosméticos vs. funcionais (boosts, consumíveis) claramente separados, para nunca comprometer a competição justa.
- **🎯 Desafios diários** — 3 por dia, incluindo sempre um desafio obrigatório do tipo "X passos até às HH:MM".
- **🏆 Leaderboards** — rankings diários/semanais/mensais/all-time em Redis Sorted Sets (O(log n)).
- **🔐 Anti-cheat em camadas** — fonte de dados oficial, ignorar entradas manuais, caps diários, deteção de picos impossíveis — com espaço para camadas mais avançadas (App Attest / Play Integrity).

## 🏗️ Arquitetura

Princípio central: **o servidor é sempre a fonte de verdade da economia**. O telemóvel só reporta passos brutos (via um `HealthProvider` — hoje um `MockHealthProvider`, amanhã HealthKit/Health Connect); todo o cálculo de moeda, XP, masmorras e taverna acontece no backend, dentro de transações de base de dados.

```
apps/mobile  (React Native + Expo Router)
     │  reporta passos / consome API
     ▼
apps/api     (NestJS)
     │
     ├── PostgreSQL  → economia (ledger append-only), personagem, itens, masmorras, taverna
     └── Redis        → leaderboards (Sorted Sets), filas, cache
```

| Camada | Tecnologia |
|---|---|
| Mobile | React Native · Expo Router · TypeScript |
| Backend | NestJS · Prisma |
| Base de dados | PostgreSQL |
| Cache / Leaderboards | Redis |
| Autenticação | JWT (Passport) |
| Infra local | Docker Compose |
| Monorepo | npm workspaces |

Documentação técnica completa (modelo de dados, endpoints, jobs, roadmap por fases) em **[PLANO_TECNICO.md](PLANO_TECNICO.md)**.

## 📂 Estrutura do projeto

```
apps/api               → Backend NestJS + Prisma (Postgres) + Redis
apps/mobile            → App Expo (React Native + Expo Router)
packages/game-config    → Constantes de economia/progressão partilhadas
packages/shared-types   → Tipos TypeScript partilhados entre api e mobile
```

## 🚀 Getting started

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

A app usa por defeito um `MockHealthProvider` ([src/health/mock-provider.ts](apps/mobile/src/health/mock-provider.ts)) que simula passos, para se poder testar todo o loop (sync → coins → XP → desafios) sem sensores reais. Substituir por HealthKit/Health Connect é uma questão de implementar `HealthProvider` ([src/health/types.ts](apps/mobile/src/health/types.ts)) e trocar `getHealthProvider()` — nada mais na app precisa de mudar.

## 🗺️ Roadmap

- [x] **Fase 1 — MVP**: auth, sync de passos, personagem, wallet/ledger, loja, desafios diários, leaderboard individual
- [x] **Fase 3 (parcial) — RPG avançado**: skills completas, silhueta de equipamento, masmorras idle, taverna
- [ ] **Fase 2 — Social**: clãs, convites, leaderboard de clã
- [ ] **Fase 4 — Polimento**: HealthKit/Health Connect reais, anti-cheat avançado, notificações, eventos sazonais

## 📄 Documentação

- **[PLANO_TECNICO.md](PLANO_TECNICO.md)** — arquitetura completa, modelo de dados, endpoints, roadmap detalhado por fases.
