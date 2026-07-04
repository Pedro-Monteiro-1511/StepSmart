# StepSmart — Plano Técnico Completo

> App mobile gamificada (RPG) onde os **passos reais** do utilizador são a currency principal do jogo.
> iOS + Android. Documento de arquitetura, modelo de dados, roadmap e recomendações de implementação.

---

## 0. Sumário executivo

- **Conceito:** cada utilizador tem 1 personagem. Passos → moeda (`coins`) + XP. Moeda compra itens; XP sobe nível; skills melhoram gameplay; clãs e leaderboards dão camada social/competitiva.
- **Direção de estilo (inspirada em Shakes & Fidget):** o personagem mostra-se como uma **silhueta com o equipamento visível à volta** (elmo, armadura, arma, escudo, pet); além dos desafios baseados em passos, existem **Masmorras** (eventos de combate **simulados/idle** — o jogador não luta em tempo real, o servidor resolve e devolve um log narrado + loot) e uma **Taverna** com missões rotativas baseadas em tempo, não em passos. Estas três peças são uma **camada de apresentação e engagement adicional** — não substituem o princípio de que os passos reais são a currency; Masmorras/Taverna consomem coins/tempo, nunca os geram do nada.
- **Stack recomendada (resumo):** **React Native + Expo** (mobile), **NestJS (Node/TypeScript)** (backend), **PostgreSQL + Redis** (dados/cache), **Firebase Auth ou Auth0** (auth), jobs em **BullMQ**.
- **Princípio director:** o servidor é a **fonte de verdade**. O telemóvel apenas reporta passos (a partir de Apple Health / Health Connect); o backend valida, converte e credita. Nunca confies no cliente para creditar moeda/XP.
- **Estratégia de entrega:** MVP simples e vertical (login → passos → moeda → loja → 1 missão → leaderboard), depois social/clãs, depois RPG profundo (visual do personagem, masmorras, taverna), depois polimento/anti-cheat.

---

## 1. Stack recomendada

### Mobile
| Opção | Recomendação | Porquê |
|---|---|---|
| **React Native + Expo (TypeScript)** | ✅ **Escolha principal** | Um só código base iOS+Android, ecossistema maduro, OTA updates (EAS Update), rápido para MVP. Ecrãs RPG são viáveis com Skia/Reanimated. |
| Flutter | Alternativa válida | Ótima performance de UI/animação; menos maduro para libs de saúde específicas. |
| Nativo (Swift/Kotlin) | Só se precisares de performance gráfica extrema | Custo x2 de desenvolvimento. |

**Libs mobile chave:**
- Saúde: `react-native-health` (Apple HealthKit) + `react-native-health-connect` (Android Health Connect). Health Connect é o caminho oficial atual (Google Fit APIs estão a ser descontinuadas).
- Estado/dados: **TanStack Query** (server state) + **Zustand** (UI state).
- Navegação: **Expo Router** ou React Navigation.
- Animação: **Reanimated 3** + **React Native Skia** (efeitos RPG, barras de XP, partículas, e a silhueta em camadas do personagem — ver §6).
- Background: `expo-task-manager` + `expo-background-fetch` para sync periódico.
- Notificações: **Expo Notifications** (push) + agendamento local para lembretes de desafios e masmorras/taverna prontas a reclamar.

### Backend
- **NestJS (Node + TypeScript)** — modular, opinativo, DI, ótimo para dividir em módulos (auth, steps, character, shop, missions, dungeons, tavern, clans, leaderboards). Partilha tipos com o mobile (monorepo).
- Alternativas: **Go (Fiber/Echo)** se quiseres performance máxima nos jobs de leaderboard; **Django/DRF** se preferires Python. Recomendo NestJS pela partilha de TypeScript.
- **ORM:** Prisma (DX excelente) ou TypeORM.

### Base de dados
- **PostgreSQL** — relacional, transações ACID (crítico para a wallet/economia), suporta `JSONB` para stats flexíveis e window functions para rankings.
- **Redis** — cache, rate limiting, **leaderboards com Sorted Sets** (`ZADD`/`ZREVRANK` — feitos à medida para isto), locks de idempotência, filas.
- (Opcional futuro) **TimescaleDB / partições por data** para `step_logs` quando o volume crescer.

### Autenticação
- **Firebase Auth** (mais barato/rápido para começar; login social Apple/Google fácil, obrigatório Apple Sign-In se tiveres outros logins sociais em iOS) **ou Auth0**.
- Backend valida o JWT do provider e emite o seu próprio access/refresh token (sessão do jogo).

### Infra / DevOps
- **Deploy backend:** Railway/Render/Fly.io (MVP) → AWS ECS/Fargate ou Kubernetes (escala).
- **CI/CD mobile:** EAS Build + EAS Submit.
- **Observabilidade:** Sentry (crashes mobile + erros backend), Grafana/Prometheus ou Datadog.
- **Analytics de produto:** PostHog ou Amplitude.

---

## 2. Arquitetura de alto nível

```
┌────────────────────┐        HTTPS/REST + JWT        ┌─────────────────────────┐
│   App (RN/Expo)    │  ───────────────────────────▶  │      API (NestJS)       │
│                    │                                │  Auth · Steps · Char    │
│ HealthKit /        │  ◀───────────────────────────  │  Shop · Missions · Clan │
│ Health Connect     │        respostas/estado         │  Dungeons · Tavern      │
└─────────┬──────────┘                                │  Leaderboards           │
          │ lê passos localmente                      └───────┬─────────┬───────┘
          │ (delta desde último sync)                         │         │
          │                                            ┌───────────┐  ┌────────┐
          └───────── envia batches ──────────────────▶│ PostgreSQL│  │ Redis  │
                                                       └─────┬─────┘  └───┬────┘
                                                             │            │ ZSET leaderboards
                                                  ┌──────────▼──────┐     │ cache · locks
                                                  │  Workers (BullMQ)│◀───┘
                                                  │  cron jobs       │
                                                  └──────────────────┘
```

**Regra de ouro:** o cliente **reporta** passos; o servidor **decide** quanta moeda/XP dar, e é também o servidor que **resolve masmorras e missões da taverna** (o cliente nunca calcula resultados de combate ou recompensas — só os apresenta). Toda a economia (crédito de coins, XP, compras, recompensas) acontece dentro de **transações de base de dados** no backend.

---

## 3. Sincronização de passos (o coração da app)

### Fluxo
1. **Permissões:** ao onboarding, pedir acesso a HealthKit (iOS) / Health Connect (Android), com ecrã explicativo antes do prompt nativo.
2. **Leitura local:** a app lê passos por intervalos (ex.: agregados horários) desde o último `syncCursor` guardado localmente.
3. **Envio em batch:** POST `/steps/sync` com uma lista de "buckets": `{ start, end, steps, source }`. Enviar sempre **janelas horárias** (não só total do dia) — permite anti-cheat e desafios por período.
4. **Idempotência:** cada bucket tem uma chave determinística (`userId + start + end`). O servidor faz **upsert** — reenviar o mesmo bucket não duplica passos. Guarda um hash/`clientBatchId` para deduplicar.
5. **Reconciliação:** o servidor recalcula o total do dia a partir dos buckets (nunca soma deltas cegamente), aplica limites anti-abuso, e credita a diferença de moeda/XP ainda não creditada.
6. **Fontes:** guardar `source` (device model, "HealthKit"/"HealthConnect", se foi `wasUserEntered`/manual). **Ignorar dados manuais** por defeito (não creditam).

### Frequência
- Sync ao abrir a app (foreground) + background fetch periódico (~a cada 1–4h, o SO limita) + push "silencioso" opcional para forçar sync antes de fechos de ranking.
- Nunca dependas só do background: o SO pode matá-lo. O sync no foreground é a rede de segurança.

### Server-side (conversão)
```
Pseudo:
onStepSync(userId, buckets):
  tx:
    upsert step_logs por bucket (idempotente)
    totalHoje = recomputa soma dos buckets de hoje (source != manual)
    totalHoje = min(totalHoje, DAILY_STEP_CAP)          # anti-abuso
    passosCreditáveis = totalHoje - já_creditado_hoje
    coins = floor(passosCreditáveis / STEPS_PER_COIN)     # ex.: 100 passos = 1 coin
    coinsHoje = min(coins, DAILY_COIN_CAP - coins_já_hoje)
    xp = passosCreditáveis * XP_PER_STEP
    credita wallet (+coins), character (+xp) → recalcula nível
    escreve transactions + xp_logs
    marca já_creditado_hoje
    avalia progresso de desafios/missões ativos
    atualiza leaderboards (ZSET) e contribuição de clã
```

---

## 4. Sistema de passos como currency

- **Regra base:** `STEPS_PER_COIN = 100` (100 passos = 1 coin). Configurável por variável de ambiente / tabela de config para tunar economia sem deploy.
- **XP:** ex.: `1 passo = 0.1 XP` (ou 1 XP por 10 passos) + bónus de missões/desafios.
- **Limites anti-abuso:**
  - `DAILY_STEP_CAP` (ex.: 30 000 passos/dia contam para economia — o resto conta só para "total lifetime" e leaderboard "cru", mas não gera moeda infinita).
  - `DAILY_COIN_CAP` (ex.: máx. 300 coins/dia).
  - Rate de picos: rejeitar/flag buckets com >X passos/minuto (impossível fisicamente).
- **Persistência:** guardar `steps_total` (lifetime), `steps_today`, `coins_balance`, `coins_lifetime`. Reset diário à meia-noite **no timezone do utilizador** (guardar `timezone` no user).
- **Contabilidade:** toda a moeda mexe via `transactions` (ledger append-only). O `wallet.balance` é derivável/verificável somando o ledger — facilita auditoria e deteção de bugs/fraude.

---

## 5. Personagem RPG e Skills

### Character
- 1 utilizador ↔ 1 character (constraint `UNIQUE(user_id)`).
- Ganha XP de: passos, missões, desafios, eventos, **masmorras e taverna** (§9, §10).
- Sobe de nível via curva de XP (ver §12).

### Skills / Atributos (melhoráveis com coins/pontos de skill ganhos por nível)
| Skill | Efeito no jogo (mecânica sugerida) |
|---|---|
| **Stamina** | Aumenta o `DAILY_STEP_CAP` efetivo e/ou reduz penalização de falhar streak. Também define o número de **tentativas diárias de masmorra** (`maxAttempts = 3 + staminaLevel`, ver §9). |
| **Strength** | Multiplicador de XP por passo em desafios de "esforço"; contribui para o **"poder de combate"** nas masmorras (§9). |
| **Agility** | Reduz o tempo/limite de desafios com prazo (ex.: dá +30min no "faz X passos até às 12:00"); contribui para o poder de combate e para eventos de "esquiva" no log das masmorras. |
| **Endurance** | Bónus de streak: cada dia consecutivo vale mais; protege 1 "falha" por semana (streak freeze); contribui para o poder de combate (resistência a dano no log das masmorras). |
| **Luck** | Aumenta probabilidade de loot raro em cofres/recompensas, drop de itens em missões, **e a chance/qualidade do loot nas masmorras**. |
| **Discipline** | Multiplicador de coins ganhos (economia) e bónus por completar todos os 3 desafios diários; também dá bónus de coins no loot de masmorras/taverna. |

> **Design importante:** as skills afetam **economia, progressão e recompensa** — não "combate PvP real" (não há combate contra outros jogadores por passos; as masmorras do §9 são PvE simulado contra o servidor). Mantém as skills como **multiplicadores/facilitadores**, nunca como algo que torne passos "menos reais". Evita pay-to-win real: skills melhoram-se com jogo, não com dinheiro real.

### Progressão de skills
- Ao subir de nível → +N `skill_points`.
- Gastar `skill_points` (e/ou coins) para subir um nível de skill. Custo crescente por nível de skill.
- A apresentação visual das skills e do equipamento está descrita em detalhe no §6.

---

## 6. Visual do Personagem (estilo Shakes & Fidget)

### Conceito
Em vez de um avatar genérico, o ecrã Character mostra uma **silhueta do personagem com o equipamento sobreposto em camadas fixas**, à semelhança do Shakes & Fidget: cada slot ocupa sempre a mesma posição no ecrã, e o item equipado nesse slot desenha-se por cima da silhueta base.

### Slots de equipamento
| Slot | Posição visual | Notas |
|---|---|---|
| `head` | Topo (elmo/chapéu) | Cosmético |
| `body` | Torso (armadura/roupa) | Cosmético |
| `weapon` | Mão direita | Cosmético (arma decorativa, sem stats de combate diretos — ver §9 para como o "poder" é calculado) |
| `shield` | Mão esquerda (**novo slot**, adicionado nesta revisão) | Cosmético; complementa a arma visualmente como no S&F |
| `pet` | Canto inferior, ao lado do personagem | Cosmético, pode ter pequena animação |
| `aura` | Atrás da silhueta (efeito de fundo/partículas) | Efeito visual, camada mais recuada (z-index mais baixo) |
| `title` | Por baixo do nome do personagem | Texto, não visual sobre a silhueta |

- Adiciona-se `shield` a `items.category`/`items.slot` e a `characters.equipped` (JSONB): `{ head, body, weapon, shield, pet, title, aura }`.
- Cada `item` pode ter um `asset_url` próprio para a camada a desenhar; itens sem asset (ex. títulos) não afetam a silhueta.

### Implementação técnica (mobile)
- Container `position: relative` com a silhueta base ao centro; cada slot equipado é uma `Image`/SVG `position: absolute` nas coordenadas fixas desse slot, com `zIndex` a definir a ordem de sobreposição (aura atrás de tudo → corpo → armadura → pet/arma/escudo à frente).
- Tocar num slot vazio ou ocupado abre o Inventário já filtrado para esse `slot`, com preview em tempo real antes de confirmar equipar (renderiza a imagem do item candidato sobre a silhueta antes do `POST /inventory/:id/equip`).
- Animações leves (Reanimated) ao equipar/desequipar (pequeno "pop"/brilho), consistente com o `game-config` de "juice" já recomendado no §16 (UI/UX).
- Continua a distinguir-se claramente **cosmético vs funcional** (§7) — o visual do personagem em si é sempre cosmético; nenhum destes slots dá vantagem de passos/economia.

---

## 7. Loja e Inventário

### Categorias de item
| Tipo | Impacto | Exemplos |
|---|---|---|
| **Cosmético** | Nenhum no gameplay | Roupa, armaduras cosméticas, armas cosméticas, escudos cosméticos, pets, títulos, efeitos visuais (auras), molduras de avatar |
| **Funcional (boost)** | Temporário no gameplay | Boost 2× coins (2h), boost XP, streak freeze, +tempo em desafios, +1 tentativa de masmorra |
| **Consumível** | Uso único | Poção de reroll de desafio/missão da taverna, cofre de loot |

- **Diferenciação clara:** campo `item.effect_type` (`cosmetic` vs `boost` vs `consumable`) e `item.effect_payload` (JSONB com multiplicador, duração, etc.). Nunca dar vantagem competitiva permanente comprável — mantém a competição justa (passos são passos).
- **Boosts limitados:** duração e/ou cargas; aplicados como registos em `active_effects` com `expires_at`.

### Inventário
- `inventory` liga user↔item, com `quantity`, `equipped`, `acquired_at`.
- **Slots de equipamento:** head, body, weapon, **shield**, pet, title, aura (ver §6 para o layout visual). Um item por slot equipado.
- Comprar = transação atómica: debita wallet, cria/atualiza inventory, escreve `transactions`. Verificar saldo **no servidor** dentro da tx (nunca confiar no preço/saldo vindo do cliente).

---

## 8. Missões e Desafios diários

### Regras
- **3 desafios por dia**, gerados por um cron job (ver §15) à meia-noite (por timezone/segmento).
- **1 desafio é sempre obrigatório do tipo "timed steps":** *"Faz X passos até às HH:MM"* (ex.: 3000 passos até às 12:00).
- Além dos desafios diários, o jogador pode ter **1 missão diária escolhida** (objetivo maior/opcional de longo prazo do dia), e independentemente disso pode enviar o character para **Masmorras (§9)** e **Taverna (§10)**.

### Tipos de desafio (catálogo — `challenge_type`)
| Tipo | Descrição | Parametrização |
|---|---|---|
| `daily_steps` | Faz X passos hoje | `target` |
| `timed_steps` ⭐ | Faz X passos até HH:MM | `target`, `deadline` |
| `time_window` | Faz X passos entre HH e HH (ex.: manhã) | `target`, `windowStart/End` |
| `multi_period` | Caminha em ≥N períodos do dia (manhã/tarde/noite) | `periods` |
| `streak` | Mantém streak de N dias | `streakTarget` |
| `beat_pr` | Bate o teu recorde pessoal de passos | referência ao `personal_best` |
| `clan_contribution` | Contribui X passos para o clã | `target` |
| `flawless` | Completa a missão do dia sem falhar o objetivo horário | derivado |
| `early_bird` | X passos antes das 09:00 | `target`, `deadline` |
| `consistency` | Passos em ≥3 horas distintas | `hoursTarget` |

### Recompensas (`reward_payload` JSONB)
- XP, coins, itens, boosts, **pontos de clã**. Recompensa escala com dificuldade.
- Bónus por completar **os 3 desafios** no mesmo dia (afetado por `Discipline`).

### Avaliação
- Cada sync de passos dispara reavaliação dos desafios ativos do utilizador (progresso incremental).
- Um job à meia-noite fecha o dia: marca falhados, atualiza streaks, credita recompensas pendentes de "streak/flawless".

---

## 9. Masmorras (Dungeons) — combate idle simulado

### Conceito
À semelhança do Shakes & Fidget, o jogador **não controla combate em tempo real**: escolhe uma masmorra, o **servidor resolve tudo instantaneamente** e devolve um **log de combate narrado** (uma sequência de eventos, tipo "O teu personagem ataca... Esquiva... Crítico!") mais a recompensa. É uma camada de progressão adicional que consome **tentativas** e **coins**, nunca gera moeda do nada — mantém o princípio de que os passos continuam a ser a fonte real da economia (as tentativas regeneram com o tempo, mas comprar tentativas extra custa coins ganhos com passos).

### Tentativas (attempts)
- Recurso próprio, distinto de passos/coins: `attempts_available`, com um máximo diário `max_attempts = DUNGEON_BASE_ATTEMPTS + nível_da_skill_Stamina`.
- **Regeneram com o tempo** (ex.: +1 a cada `DUNGEON_ATTEMPT_REGEN_MIN` minutos, via cron — ver §15), até ao `max_attempts`.
- Podem comprar-se **tentativas extra com coins** no próprio dia, com custo crescente por compra (`DUNGEON_EXTRA_ATTEMPT_COST_BASE`, dobra a cada compra extra nesse dia) — desincentiva "grind" descontrolado sem tocar em dinheiro real.

### Masmorras (catálogo)
- Desbloqueiam por nível (`min_level`), com dificuldade crescente (`difficulty`) e tabela de loot própria (`loot_table`).

### Resolução (server-side, dentro de uma transação)
```
Pseudo:
onEnterDungeon(userId, dungeonId):
  tx:
    regenera attempts (com base no tempo desde last_regen_at, cap em max_attempts)
    valida attempts_available > 0 → debita 1
    poderDoCharacter = f(nível, Strength, Agility, Endurance)
    poderDaMasmorra  = dungeon.difficulty
    chanceVitoria = clamp(0.15, 0.95, poderDoCharacter / (poderDoCharacter + poderDaMasmorra))
    resultado = random() < chanceVitoria ? WIN : LOSE
    combatLog = gera 3–6 eventos narrados (ataque/esquiva/crítico) a partir das stats
    se WIN:
      loot = rola loot_table (afetado por Luck)
      credita xp_reward_win + coins_reward_win (+ bónus Discipline) + loot ao inventário
    se LOSE:
      credita xp de consolação reduzido, sem loot
    grava dungeon_run (log completo, resultado, recompensas)
```

### Skills aplicadas
- **Strength/Agility/Endurance** → "poder de combate" (chance de vitória).
- **Luck** → qualidade/probabilidade do loot.
- **Stamina** → tentativas diárias disponíveis.
- **Discipline** → bónus de coins no loot.

Isto dá um **propósito de combate concreto** às skills que no §5 eram descritas de forma mais abstrata — o jogador sente o efeito das skills diretamente no resultado das masmorras.

---

## 10. Taverna — missões rotativas baseadas em tempo

### Conceito
Ecrã dedicado ("Taverna") com **3 missões rotativas** (renovadas periodicamente, ex. a cada `TAVERN_QUEST_REFRESH_HOURS` horas), no estilo do S&F onde se envia o herói a "buscar" algo. Ao contrário dos Desafios Diários (§8), **não dependem de passos reais** — dependem de **tempo de espera simulado**: o jogador inicia a missão, o character fica "ocupado" X minutos (com contador na UI), e ao terminar o jogador reclama o resultado (narrado, tal como nas masmorras).

### Regras
- Iniciar uma missão da taverna tem um **pequeno custo em coins** (ou é grátis com cooldown, a definir em `tavern_quests.cost_coins`).
- Só é possível ter 1 missão da taverna ativa de cada vez (evita paralelizar infinitamente).
- Ao terminar (`now >= ends_at`), o estado passa a `completed`; o jogador reclama via endpoint próprio, que credita a recompensa (`reward_payload`: XP, coins, item raro, ou nada — com uma pequena narrativa de resultado).

### Objetivo de design
Dar uma **sensação de progressão contínua** mesmo em dias com poucos passos, sem contradizer o princípio central: a Taverna consome coins/tempo, não gera moeda do nada — quem anda mais continua a ter vantagem (mais coins para iniciar mais missões, mais tentativas de masmorra, character mais forte).

---

## 11. Clãs / Grupos

### Estrutura
- Clã: `name`, `description`, `leader_id`, `member_count`, `xp_total`, `steps_total`, `rank`, `created_at`, `max_members`.
- Membro pertence a **1 clã de cada vez** (`UNIQUE(user_id)` em `clan_members`).

### Papéis / permissões
| Ação | Membro | Moderador | Líder |
|---|:---:|:---:|:---:|
| Contribuir passos | ✅ | ✅ | ✅ |
| Ver membros | ✅ | ✅ | ✅ |
| Convidar | ❌ | ✅ | ✅ |
| Aceitar/rejeitar convites | ❌ | ✅ | ✅ |
| Expulsar membro | ❌ | ✅ (só membros) | ✅ |
| Promover/despromover | ❌ | ❌ | ✅ |
| Editar nome/descrição | ❌ | ✅ | ✅ |
| Transferir liderança | ❌ | ❌ | ✅ |
| Dissolver clã | ❌ | ❌ | ✅ |

### Regras
- **Entrar:** por convite aceite, ou pedido a clã público (aprovado por mod/líder). Se já pertence a um clã → sair primeiro.
- **Sair:** livre; se for o líder e houver membros → obrigatório transferir liderança antes (ou promoção automática do membro mais antigo/mais ativo). Se ficar vazio → clã arquivado/apagado.
- **Expulsar:** mod/líder; não se pode expulsar alguém de papel igual/superior.
- **Transferir liderança:** só líder → escolhe novo líder; o antigo passa a moderador.
- **Contribuição:** os passos diários do membro somam ao `steps_total`/`xp_total` do clã e a um `clan_contribution` individual (para ranking interno e desafios de clã).

---

## 12. Progressão RPG (XP, níveis, curvas)

### Curva de XP
- Fórmula recomendada (crescimento suave mas não trivial):
  `xpParaNível(n) = base * n^1.5` (ex.: `base = 100`) → nível 2: 283, nível 10: ~3162, nível 50: ~35 355.
- Ou tabela por escalões para controlar economia manualmente nos primeiros níveis.
- **Evitar que fique fácil demais:** capar XP diário de passos (via `DAILY_STEP_CAP`), fazer o "grosso" do XP de topo vir de **desafios/streaks/eventos/masmorras** e não só de passos brutos. Assim jogar bem > só andar muito num dia.

### Desbloqueios por nível
| Nível (exemplo) | Desbloqueio |
|---|---|
| 1 | Character base, 1 slot equipamento, primeiros desafios |
| 5 | Skills desbloqueadas, 2º slot, primeiras masmorras |
| 10 | Sistema de clãs, título "Wanderer", Taverna desbloqueada |
| 15 | Slot de pet, novas missões, masmorras de dificuldade média |
| 20 | Novas skins, efeitos visuais na loja (auras) |
| 30 | Slot de aura, desafios avançados, masmorras difíceis |
| 50 | Título prestígio, cofre lendário semanal, masmorra "épica" |

Desbloqueios: novas skins, novas missões, novas skills, novas slots de equipamento, novos títulos, novos tipos de desafio, novas masmorras.

---

## 13. Leaderboards

### Tipos
- **Individual** e **por clã**.
- **Janelas:** diário, semanal, mensal, all-time.
- **Métricas:** passos, XP, nível, missões concluídas, contribuição para o clã.

### Implementação
- **Redis Sorted Sets** por (métrica × janela): chave `lb:steps:weekly:2026-W27` → `ZADD score=passos member=userId`. Leitura de ranking = `ZREVRANGE`/`ZREVRANK` (O(log n)).
- Janelas com **expiração automática** (TTL) para diário/semanal; snapshots persistidos em Postgres (`leaderboards`) no fecho de cada janela (job) para histórico e prémios.
- Atualização: cada crédito de passos/XP faz `ZINCRBY`. Leaderboards de clã agregam contribuições.

### Anti-batota nos rankings
- Só entram passos validados (source oficial, não manual, dentro dos caps).
- **Shadow-flag:** utilizadores marcados como suspeitos entram num leaderboard "shadow" e não aparecem no público (não sabem que estão flagged).
- Recompensas de topo só liberadas após verificação (revisão de flags antes de pagar prémios de fim de semana/mês).

---

## 14. Anti-cheat e validação de passos

### Riscos
- Apps que injetam passos falsos, "shake" do telemóvel, ventoinhas/máquinas, dados manuais inflacionados, root/jailbreak a falsificar HealthKit, reenvio de batches.

### Estratégias (por camadas, do MVP ao avançado)
1. **Fonte confiável:** ler de **HealthKit / Health Connect** (agregam sensores + reduzem injeção trivial), guardar `source` e `wasUserEntered`.
2. **Ignorar dados manuais** (não creditam economia; podem contar só como informativo).
3. **Limites diários** (`DAILY_STEP_CAP`, `DAILY_COIN_CAP`).
4. **Deteção de picos impossíveis:** >~200 passos/min sustidos, ou saltos irrealistas entre buckets → rejeita/flag.
5. **Consistência distância/tempo/calorias:** cruzar passos com `distance`/`activeEnergy` do Health API; rácio passos↔distância fora do humano → flag.
6. **Idempotência + assinatura de batch:** cada bucket com chave determinística; detetar reenvios e batches sobrepostos.
7. **Integridade de dispositivo:** App Attest (iOS) / Play Integrity (Android) para validar que o pedido vem da app genuína num device não comprometido.
8. **Flags de atividade suspeita:** score de risco por utilizador; acima do limiar → shadow leaderboard + revisão manual + possível reversão de recompensas.
9. **Rate limiting** por utilizador/IP na API.

> Não precisa de ser perfeito no MVP: começa com fonte oficial + caps + ignore manual + picos impossíveis. As camadas 5–8 entram na Fase 4.

---

## 15. Jobs / Background tasks

| Job | Trigger | Função |
|---|---|---|
| `generateDailyChallenges` | Cron 00:00 (por timezone/segmento) | Gera 3 desafios/dia (1 obrigatório `timed_steps`) por utilizador ou por pool. |
| `closeDayAndStreaks` | Cron 00:05 | Fecha desafios do dia anterior, atualiza streaks, marca falhados, credita recompensas pendentes. |
| `rollupLeaderboards` | Cron fim de janela (diário/semanal/mensal) | Snapshot dos ZSETs para Postgres, distribui prémios, reseta janela. |
| `recomputeClanAggregates` | Após sync / cron horário | Recalcula `steps_total`/`xp_total`/rank dos clãs. |
| `expireBoosts` | Cron 5–15 min | Remove `active_effects` expirados. |
| `regenDungeonAttempts` | Cron 5–10 min | Recalcula `attempts_available` de cada `user_dungeon_state` com base no tempo desde `last_regen_at` (cap em `max_attempts`). |
| `refreshTavernQuests` | Cron a cada `TAVERN_QUEST_REFRESH_HOURS` (ex. 3×/dia) | Gera novo conjunto de 3 `tavern_quests` ativas por utilizador (ou pool partilhado, como os desafios diários). |
| `resolveTavernQuests` | Cron 1–5 min | Marca `user_tavern_quests` como `completed` quando `now >= ends_at`, pronto a reclamar. |
| `fraudScan` | Cron horário/diário | Recalcula risk score, aplica shadow-flags. |
| `sendReminders` | Cron (ex.: 11:00, 19:00) | Push "faltam X passos para o desafio das 12:00" / "a tua missão da taverna já terminou". |
| `processStepSyncQueue` | Fila (BullMQ) | Processa syncs pesados/reavaliação de missões fora do request. |

Ferramenta: **BullMQ** (Redis) para filas + **@nestjs/schedule** ou um scheduler distribuído (evitar duplicação em multi-instância — usar locks Redis).

---

## 16. Modelo de dados (inicial)

> PostgreSQL. `id` = UUID (ou bigint). Timestamps `created_at`/`updated_at` em todas. Tipos indicativos.

### users
`id`, `email` (unique), `username` (unique), `password_hash` (se local) / `auth_provider`, `auth_provider_id`, `timezone`, `avatar_url`, `status` (active/banned/shadow), `created_at`, `last_login_at`

### characters
`id`, `user_id` (FK, **unique** → 1:1), `name`, `level`, `xp`, `xp_to_next`, `skill_points`, `equipped` (JSONB: `{head, body, weapon, shield, pet, title, aura}` — ver §6), `appearance` (JSONB), `created_at`

### character_stats
`id`, `character_id` (FK, unique), `stamina`, `strength`, `agility`, `endurance`, `luck`, `discipline` (cada com `level` + eventualmente `value` calculado). Ou linhas por skill: `character_id`, `skill_key`, `level`.

### step_logs
`id`, `user_id` (FK), `bucket_start`, `bucket_end`, `steps`, `distance_m`, `active_energy`, `source`, `is_manual` (bool), `client_batch_id`, `credited` (bool), `created_at`
— **Índice/constraint:** `UNIQUE(user_id, bucket_start, bucket_end, source)`; índice por `(user_id, bucket_start)`.

### wallets
`id`, `user_id` (FK, unique), `coins_balance`, `coins_lifetime`, `updated_at`

### transactions (ledger append-only)
`id`, `user_id` (FK), `type` (`step_credit`/`purchase`/`reward`/`refund`/`admin`/`dungeon_reward`/`tavern_reward`), `amount` (+/-), `balance_after`, `reference_type`, `reference_id`, `metadata` (JSONB), `created_at`

### items (catálogo)
`id`, `key` (unique), `name`, `description`, `category` (clothing/armor/weapon/**shield**/pet/title/effect/boost/consumable), `effect_type` (`cosmetic`/`boost`/`consumable`), `effect_payload` (JSONB), `rarity`, `price_coins`, `slot`, `min_level`, `is_active`, `asset_url`

### inventory
`id`, `user_id` (FK), `item_id` (FK), `quantity`, `equipped` (bool), `acquired_at`
— `UNIQUE(user_id, item_id)` para stackáveis.

### active_effects
`id`, `user_id`, `item_id`, `effect_payload`, `starts_at`, `expires_at`, `charges_left`

### missions (catálogo de missões)
`id`, `key`, `title`, `description`, `type`, `target`, `reward_payload` (JSONB), `min_level`, `is_active`

### daily_challenges (definição do dia / template gerado)
`id`, `date`, `challenge_type`, `title`, `params` (JSONB: target/deadline/window), `difficulty`, `reward_payload` (JSONB), `is_mandatory` (bool)

### user_daily_challenges (instância por utilizador)
`id`, `user_id` (FK), `daily_challenge_id` (FK), `date`, `progress`, `target`, `status` (`active`/`completed`/`failed`), `completed_at`, `reward_claimed` (bool)
— `UNIQUE(user_id, daily_challenge_id)`.

### user_streaks
`id`, `user_id` (unique), `current_streak`, `longest_streak`, `last_active_date`, `freezes_available`

### dungeons (catálogo — NOVO, §9)
`id`, `key` (unique), `name`, `description`, `min_level`, `difficulty` (int, usado no cálculo de chance de vitória), `loot_table` (JSONB: lista de `{itemKey, weight}`), `xp_reward_win`, `xp_reward_lose`, `coins_reward_win`, `is_active`

### dungeon_runs (log de tentativas — NOVO, §9)
`id`, `user_id` (FK), `dungeon_id` (FK), `result` (`win`/`lose`), `combat_log` (JSONB, array de eventos narrados), `xp_gained`, `coins_gained`, `loot_item_id` (FK `items`, nullable), `created_at`

### user_dungeon_state (NOVO, §9)
`id`, `user_id` (unique), `attempts_available`, `max_attempts`, `last_regen_at`, `extra_attempts_bought_today`, `date` (para reset diário do contador de compras)

### tavern_quests (catálogo — NOVO, §10)
`id`, `key` (unique), `title`, `description`, `duration_minutes`, `min_level`, `cost_coins`, `reward_payload` (JSONB), `is_active`

### user_tavern_quests (instância ativa/histórico — NOVO, §10)
`id`, `user_id` (FK), `tavern_quest_id` (FK), `started_at`, `ends_at`, `status` (`in_progress`/`completed`/`claimed`), `result_payload` (JSONB — narrativa + recompensa resolvida)
— índice em `(user_id, status)`; regra de negócio (não constraint de BD): só 1 linha `in_progress` por utilizador de cada vez.

### clans
`id`, `name` (unique), `description`, `leader_id` (FK users), `member_count`, `max_members`, `xp_total`, `steps_total`, `is_public` (bool), `rank`, `created_at`

### clan_members
`id`, `clan_id` (FK), `user_id` (FK, **unique** → 1 clã por user), `role` (`leader`/`moderator`/`member`), `contribution_steps`, `contribution_xp`, `joined_at`

### clan_invites
`id`, `clan_id` (FK), `inviter_id`, `invitee_id`, `status` (`pending`/`accepted`/`declined`/`expired`), `created_at`, `expires_at`
— `UNIQUE(clan_id, invitee_id)` enquanto pending.

### leaderboards (snapshots persistidos)
`id`, `scope` (`individual`/`clan`), `metric` (`steps`/`xp`/`level`/`missions`/`clan_contribution`), `window` (`daily`/`weekly`/`monthly`/`all_time`), `period_key` (ex.: `2026-W27`), `subject_id` (user/clan), `score`, `rank`, `created_at`
— live rankings ficam em Redis ZSET; isto é o histórico/snapshot.

### xp_logs
`id`, `user_id` (FK), `source` (`steps`/`mission`/`challenge`/`event`/`dungeon`/`tavern`), `amount`, `reference_id`, `level_before`, `level_after`, `created_at`

### Relações (resumo)
- `users` 1—1 `characters` 1—1 `character_stats`
- `users` 1—1 `wallets`, 1—N `transactions`, 1—N `step_logs`, 1—N `xp_logs`
- `users` 1—N `inventory` N—1 `items`
- `users` 1—N `user_daily_challenges` N—1 `daily_challenges`
- `users` 1—1 `user_dungeon_state`, 1—N `dungeon_runs` N—1 `dungeons`
- `users` 1—N `user_tavern_quests` N—1 `tavern_quests`
- `clans` 1—N `clan_members` (user 1—1 membership), 1—N `clan_invites`

---

## 17. Endpoints principais (REST)

### Auth
- `POST /auth/register` · `POST /auth/login` · `POST /auth/social` · `POST /auth/refresh` · `POST /auth/logout` · `GET /auth/me`

### Character / Stats
- `GET /character` · `PATCH /character` (nome/aparência) · `GET /character/stats`
- `POST /character/skills/:key/upgrade` (gasta skill_points/coins)

### Steps
- `POST /steps/sync` (batch idempotente) · `GET /steps/today` · `GET /steps/history?from&to`

### Wallet
- `GET /wallet` · `GET /wallet/transactions`

### Shop / Inventory
- `GET /shop/items` · `POST /shop/purchase` (`{itemId}`) · `GET /inventory` · `POST /inventory/:id/equip` · `POST /inventory/:id/unequip` · `POST /inventory/:id/use` (consumível/boost)

### Missions / Challenges
- `GET /challenges/today` · `POST /challenges/:id/claim` · `POST /challenges/:id/reroll` (com item) · `GET /missions` · `POST /missions/:id/select`

### Dungeons (NOVO, §9)
- `GET /dungeons` (catálogo desbloqueado para o nível do character) · `GET /dungeons/state` (tentativas disponíveis/`max_attempts`/regeneração) · `POST /dungeons/:id/enter` (resolve a masmorra, devolve `combat_log` + recompensa) · `POST /dungeons/state/buy-attempt` (compra tentativa extra com coins) · `GET /dungeons/runs` (histórico paginado)

### Tavern (NOVO, §10)
- `GET /tavern/quests` (as 3 missões ativas + estado da missão em curso, se houver) · `POST /tavern/quests/:id/start` · `POST /tavern/quests/:id/claim`

### Clans
- `POST /clans` · `GET /clans/:id` · `PATCH /clans/:id` · `POST /clans/:id/invite` · `POST /clans/invites/:id/accept` · `POST /clans/invites/:id/decline` · `POST /clans/:id/leave` · `POST /clans/:id/kick` · `POST /clans/:id/promote` · `POST /clans/:id/transfer-leadership` · `GET /clans/:id/members`

### Leaderboards
- `GET /leaderboards?scope=&metric=&window=&period=` · `GET /leaderboards/me` (a minha posição) · `GET /leaderboards/clans?...`

### Profile / Settings
- `GET /profile/:id` · `PATCH /settings` · `POST /notifications/register-token`

> Convenções: JWT em `Authorization: Bearer`; idempotência via `Idempotency-Key` header em `/steps/sync`, `/shop/purchase` e `/dungeons/:id/enter`; paginação por cursor nas listas.

---

## 18. Estrutura de pastas (monorepo)

```
stepsmart/
├─ apps/
│  ├─ mobile/                 # React Native + Expo
│  │  ├─ src/
│  │  │  ├─ screens/          # Login, Home, Character, Skills, Shop, Inventory,
│  │  │  │                    # Challenges, Dungeons, Tavern, Clan, Leaderboards,
│  │  │  │                    # Profile, Settings
│  │  │  ├─ components/       # inclui CharacterSilhouette/ (camadas de equipamento, §6)
│  │  │  ├─ features/         # health/, steps/, character/, shop/, dungeons/, tavern/, clan/...
│  │  │  ├─ services/         # apiClient, healthService (HealthKit/HealthConnect)
│  │  │  ├─ store/            # zustand
│  │  │  ├─ hooks/
│  │  │  └─ navigation/
│  │  └─ app.json
│  └─ api/                    # NestJS
│     ├─ src/
│     │  ├─ modules/
│     │  │  ├─ auth/
│     │  │  ├─ users/
│     │  │  ├─ character/
│     │  │  ├─ steps/
│     │  │  ├─ wallet/
│     │  │  ├─ shop/
│     │  │  ├─ missions/
│     │  │  ├─ dungeons/      # NOVO — catálogo, resolução, estado de tentativas
│     │  │  ├─ tavern/        # NOVO — missões rotativas baseadas em tempo
│     │  │  ├─ clans/
│     │  │  ├─ leaderboards/
│     │  │  └─ jobs/          # workers BullMQ + cron
│     │  ├─ common/           # guards, interceptors, filters, dto
│     │  ├─ config/
│     │  └─ main.ts
│     └─ prisma/schema.prisma
├─ packages/
│  ├─ shared-types/           # tipos partilhados mobile↔api
│  └─ game-config/            # constantes de economia (STEPS_PER_COIN, curvas, caps, masmorras, taverna)
├─ docker-compose.yml         # postgres + redis local
└─ package.json               # workspaces (pnpm/turbo)
```

---

## 19. UI/UX — ecrãs principais

| Ecrã | Conteúdo |
|---|---|
| **Login/Registo** | Email + social (Apple/Google). Onboarding: criar character, pedir permissões de saúde com explicação. |
| **Home / Dashboard** | Passos de hoje (anel de progresso), coins, XP/nível, os 3 desafios do dia com progresso, streak, botão sync, atalhos para Masmorras/Taverna se houver algo pronto a reclamar. |
| **Character** | **Silhueta do personagem com equipamento visível à volta** (§6): elmo, armadura, arma, escudo, pet, aura; nome + título por baixo; nível, barra de XP, stats resumidas. |
| **Skills** | 6 skills com nível atual, efeito (incl. impacto em masmorras — poder de combate, tentativas, loot), custo de upgrade, skill_points disponíveis. |
| **Loja** | Grelha por categoria (incl. escudos), raridade, preço em coins, filtro cosmético/boost, preview na silhueta do personagem antes de comprar, botão comprar. |
| **Inventário** | Itens possuídos, equipar/desequipar por slot (com preview na silhueta), usar boosts/consumíveis, filtros. |
| **Desafios diários** | 3 desafios (1 obrigatório timed destacado), progresso, recompensas, botão claim, reroll (se tiver item), missão diária selecionável. |
| **Masmorras** *(novo, §9)* | Lista de masmorras desbloqueadas, tentativas disponíveis/tempo até à próxima, botão "Entrar" que dispara a resolução no servidor e mostra o **log de combate narrado** com animação, seguido do loot/recompensa. Histórico de tentativas anteriores. |
| **Taverna** *(novo, §10)* | 3 missões rotativas com duração e recompensa esperada; se houver uma em curso, mostra contador até `ends_at`; ao terminar, botão para reclamar com pequena narrativa de resultado. |
| **Clã** | Nome/descrição/rank, lista de membros com papel e contribuição, convites pendentes, ações por permissão, desafios de clã. |
| **Leaderboards** | Tabs (individual/clã), seletor de métrica e janela (diário/semanal/mensal/all-time), a minha posição fixada no topo. |
| **Perfil** | Stats lifetime (passos totais, dias ativos, recorde), títulos, badges, clã atual, masmorra mais difícil vencida. |
| **Definições** | Permissões de saúde, notificações, timezone, conta, privacidade, logout, apagar conta (obrigatório para stores). |

**Notas UX:** feedback imediato e satisfatório ao ganhar coins/XP (animações, "juice"), lembretes push acionáveis ("faltam 800 passos para o desafio das 12:00", "a tua missão da taverna já chegou", "tens tentativas de masmorra cheias"), estados vazios claros, e nunca bloquear o loop core (ver passos → ganhar → gastar). O log de combate das masmorras e a narrativa da taverna são a principal oportunidade de dar **personalidade e humor ao texto** do jogo, mesmo mantendo o resto da interface num tom neutro.

---

## 20. Roadmap por fases

### Fase 1 — MVP (fatia vertical funcional)
- Registo/login (email + 1 social).
- Integração de passos (HealthKit/Health Connect) + sync idempotente.
- Character básico (nível, XP, avatar simples — **sem** a silhueta completa de equipamento ainda, ver Fase 3).
- Conversão passos→coins + wallet + ledger + caps básicos.
- Loja simples (só cosméticos) + inventário + equipar.
- 3 desafios diários simples (incl. o `timed_steps` obrigatório) + claim de recompensas.
- Leaderboard individual (passos, semanal) via Redis.
- **Objetivo:** provar o loop core e a economia. Anti-cheat mínimo (fonte oficial + caps + ignore manual).

### Fase 2 — Social e clãs
- Criar/gerir clãs, papéis, convites, sair/expulsar/transferir.
- Contribuição de passos para clã.
- Leaderboard de clãs.
- Desafios de contribuição de clã.

### Fase 3 — RPG mais avançado (estilo Shakes & Fidget)
- Skills completas + efeitos reais na economia/desafios.
- Sistema de XP completo (fontes múltiplas, curvas afinadas, desbloqueios por nível).
- Inventário rico, itens equipáveis por slot (incl. `shield`), boosts/consumíveis.
- **Silhueta do personagem com slots de equipamento visíveis** (§6) — a peça de "progressão visual" desta fase.
- **Masmorras idle** com log de combate simulado e loot (§9).
- **Taverna com missões rotativas** baseadas em tempo (§10).

### Fase 4 — Polimento
- Anti-cheat avançado (distância/energia, App Attest/Play Integrity, risk score, shadow leaderboards).
- Notificações inteligentes (incl. masmorras/taverna prontas).
- Eventos semanais/sazonais, cofres, prémios de ranking, masmorras de evento.
- Melhor UI/UX + animações (log de combate mais rico, mais humor no texto).
- Analytics + A/B testing da economia.

---

## 21. Riscos técnicos e mitigações

| Risco | Mitigação |
|---|---|
| **Fraude de passos** destrói a economia | Fonte oficial, caps, ignore manual, picos impossíveis, risk score, App Attest/Play Integrity (§14). |
| **Background sync não fiável** (SO mata processos) | Sync robusto no foreground + reconciliação idempotente; nunca depender só do background. |
| **Fusos horários / reset diário** | Guardar `timezone` do user; jobs por segmento; "dia" sempre no TZ do user. |
| **Consistência da economia** (double credit, saldos errados) | Tudo em transações DB, ledger append-only, idempotência por chave/`Idempotency-Key`. |
| **Masmorras/Taverna viram fonte de moeda "grátis" e desequilibram a economia** | Tentativas de masmorra e missões da taverna nunca dão mais coins do que o custo para as obter compensa; balancear `loot_table`/`reward_payload` para que o retorno esperado seja sempre inferior ao investido em coins+tempo — o crescimento real vem de andar mais, não de repetir masmorras. |
| **Health Connect / HealthKit APIs a mudar** | Abstrair num `healthService` único; Google Fit está a ser descontinuado → usar Health Connect. |
| **Leaderboards não escalam** | Redis Sorted Sets + snapshots; nunca `ORDER BY` sobre milhões em tempo real. |
| **Privacidade de dados de saúde** (GDPR / App Store) | Consentimento explícito, minimizar dados, encriptação, política de privacidade, exportar/apagar conta. Não usar dados de saúde para publicidade. |
| **Aprovação nas stores** | Apple Sign-In se houver social login; ecrã de apagar conta; justificar uso de HealthKit; sem "loot boxes" enganosas (declarar odds do `loot_table` das masmorras). |
| **Custo de jobs em multi-instância** | Locks Redis / scheduler distribuído para não duplicar crons (incl. `regenDungeonAttempts`/`refreshTavernQuests`). |
| **Balanceamento da economia** | Constantes em `game-config` + config remota (feature flags) para tunar sem redeploy; monitorizar com analytics. |

---

## 22. Recomendações práticas para começar

1. **Monorepo** (pnpm workspaces + Turborepo) com `apps/mobile`, `apps/api`, `packages/shared-types`, `packages/game-config`.
2. **Levanta a infra local primeiro:** `docker-compose` com Postgres + Redis; Prisma schema com as tabelas core.
3. **Constrói a fatia vertical mais fina possível:** login → ler passos → `POST /steps/sync` → creditar coins → ver saldo. Só depois adiciona loja/desafios/leaderboard, e só na Fase 3 masmorras/taverna/silhueta.
4. **Trata `/steps/sync` como o endpoint mais importante:** idempotência, buckets horários, caps, ledger — acerta isto cedo, é o núcleo da economia.
5. **Centraliza as constantes de economia** (`STEPS_PER_COIN`, `XP_PER_STEP`, caps, curva de nível, tentativas de masmorra, refresh da taverna) num só sítio configurável.
6. **Testa com dados de saúde reais cedo** (device físico; simuladores não dão passos reais). Cria um modo "dev" para injetar passos fake em ambiente de teste.
7. **Segurança desde o início:** JWT, rate limiting, validação de DTOs (class-validator/zod), nunca confiar no cliente para valores de economia ou resultados de masmorra/taverna.
8. **Observabilidade cedo:** Sentry + logs estruturados; um dashboard simples de "coins emitidos/dia" (incl. por masmorra/taverna) para detetar abusos ou desequilíbrio.
9. **Não construas as 4 fases de uma vez.** Lança o MVP, mede retenção do loop core, e só então investe em clãs/RPG profundo (masmorras, taverna, silhueta)/anti-cheat avançado.
10. **Feature flags** para poder ligar/desligar clãs, masmorras, taverna, eventos e ajustar economia em produção sem redeploy.

---

## 23. Constantes de economia (ponto de partida — afinar depois)

```ts
STEPS_PER_COIN     = 100      // 100 passos = 1 coin
XP_PER_STEP        = 0.1      // 10 passos = 1 XP
DAILY_STEP_CAP     = 30_000   // passos que contam para economia/dia
DAILY_COIN_CAP     = 300      // coins máx./dia
XP_CURVE           = 100 * level^1.5
SKILL_POINTS_PER_LEVEL = 1
STREAK_FREEZE_MAX  = 1        // por semana (afetado por Endurance)
CHALLENGES_PER_DAY = 3        // 1 obrigatório = timed_steps

// Masmorras (§9)
DUNGEON_BASE_ATTEMPTS           = 3     // + 1 por nível da skill Stamina
DUNGEON_ATTEMPT_REGEN_MIN       = 30    // minutos por tentativa regenerada
DUNGEON_EXTRA_ATTEMPT_COST_BASE = 20    // coins; dobra a cada compra extra no mesmo dia

// Taverna (§10)
TAVERN_QUEST_SLOTS         = 3
TAVERN_QUEST_REFRESH_HOURS = 8
```

---

*Fim do plano. Próximo passo sugerido: montar o monorepo + docker-compose + schema Prisma e implementar a fatia vertical `login → sync passos → coins`.*
