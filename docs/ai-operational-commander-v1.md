# Sandforge: Operational Commander V1 — controlled architecture reset

**Status:** test-only opt-in `operations-v1`. It does **not** replace the default, and no saved campaign contains this experimental runtime switch.

## Problem

Recent experiments repeatedly showed that legal paid production, deterministic matching, pathing and unit survival are not the same as **winning**. The 48-game comparison in #213 yielded only **7 wins** for the new policy against 6 wins for paid early barracks and 7 for classic current. #211 produced 0 new wins; #212 confirmed its gate did not even become eligible in 20 paid early-barracks matches. Structural target retention can last 100 seconds, competing with raids, production, recovery and ordinary capture missions.

The problem is fragmented mission authority, not an insufficient number of special-case thresholds.

## Authority contract

```text
PUBLIC OWNED SECTORS + RED VISIBLE/MEMORIZED ENEMIES + REAL ROUTES
                              |
                    Operations Commander
               target + phase + mission lock
                              |
        existing Campaign Commander / TacticalAI
        regroup, readiness, attack/siege, withdraw
                              |
        Simulation executes real paid combat/orders
             ^                          ^
             |                          |
      existing AI economy          local defense
        never modified            never overridden
```

1. The new module `src/reborn/operations-commander.ts` is **pure**. It receives only sanitized strategic candidates and observational summaries; it never reads Simulation, random numbers, fog-hidden opponents, buys, or issues movement orders.
2. `campaign-commander.ts` remains the only adapter that constructs observed candidates and actual reachable sampled route/risk from the existing pathfinder. Operations V1 is the **single strategic mission selector**; legacy chooseMission is skipped in this isolated mode but stays unchanged for normal games.
3. TacticalAI continues to enforce original battle-strength, siege-overrun, realistic paid artillery, defense, withdrawal, medicine and order safety. No impossible attack is allowed because a target was selected.
4. The mission *object* survives repeated operational planning while its objective remains the same. This preserves rally authority and genuine HP/distance progress across three-second macro pulses instead of resetting on every tick.
5. The runtime-only `OperationMemory` stores intent, selected target, time, recent failed target penalty and switch count. Invalid/unreachable routes never qualify. Savegames and the production default keep their original schema. Reopening a save resets the experimental planner rather than persisting speculative policy data.

## Phase model

- **expand**: acquire income on accessible neutral ground.
- **breakthrough**: pressure real enemy-owned territory when safely reachable and not protected by a still-intact enemy HQ.
- **siege**: engage observed tower structures only when a paid artillery unit is actually fielded or battle commander independently validates an overrun. Otherwise the score prefers accessible income opportunities.
- **strike-production**: destroy observed barracks/factory/airfield when feasible.
- **finish**: prioritize HQ or cleanup after actual observed HQ elimination.
- **defend**: defer to local emergency defender when RED sees an active attack on its owned buildings.
- **recover**: no visible/known reachable mission; preserve normal economy, reconnaissance and existing tactical recovery.

These are strategic *intents* (not unearned units, cheats or direct commands).

## Required evidence to promote

1. TypeScript build and targeted deterministic/fog/route/lock tests green.
2. Exactly equal initial playable state, money, fog, units, production and AI opening across paired A/B matches.
3. 48 games per strategy: 4 unchanged legal paid BLUE opponents × 12 seeds, including 8 untouched seeds 2066–2073. Timeouts must never count as wins.
4. To claim a material breakthrough: **at least 5 additional real wins versus current/paid reference without losing known wins** across same 48 settings, then reproduce against a fresh untouched seed cohort. +1 win on a repeatedly used seed is insufficient.
5. Broad 1,000+ test suite must be understood and green or transparently resolved compared with the clean baseline; the prior 18 known failures are not excused by focused tests.
6. Only then: isolated local Docker preview on a new, confirmed free port; actual user playtests; protected Uberspace release with SHA256, authenticated browser, atomic pointer and rollback. Do not overwrite existing 8095 or experimental 8106.

## Why this is a reset rather than another patch

All mission categories are evaluated together with the same real inputs and a persistent mission lock, while the execution chain remains proven. Tactical action modules stop independently choosing new strategic goals. Tradeoffs and failure modes are inspectable in one pure module. If the idea fails the win threshold, do **not** endlessly tweak its constants; use the benchmark to identify whether objective selection, assault execution or HQ finish is the dominant barrier, then make a versioned architecture decision.
