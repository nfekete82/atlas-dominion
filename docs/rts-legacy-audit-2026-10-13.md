# RTS interface and legacy-code audit — 2026-10-13

## Implemented
- Added compact military overview for physical RTS squad play: mobile reserves, genuine fielded squads, cumulative losses, selected squad, danger status and expandable combat summary.
- Hid the old Border Defense, Border Command and percentage-attack cards **only in RTS mode**. Classic controls and their original DOM elements remain mounted for compatibility.
- Added UI wiring and contract tests. No gameplay, save-format or army-math changes in this pass.

## Potential legacy code: do not delete without a separate compatibility migration

| Code / feature | Audit | Next step |
|---|---|---|
| `attackRatio`, preset buttons, `setAttackRatio` in `src/main.ts` | Still referenced by `assessAttack`, `reinforceAttack`, `reinforceBorder`, mouse hover preview and T/Y keyboard shortcuts. | In a later PR, redirect RTS commands to selected real formations and guard classic-only actions before removing these handlers. |
| `borderHotspots`, `renderBorderCommand` and border strategy | Still used by boundary navigation, right-click controls and existing deterministic border tests. | Keep engine border policies; consider a compact advanced-controls drawer if players need manual posting. |
| `frontline`, `attackOrders`, legacy reserve `factions[].troops` | Integral to the classic game mode, savegame representation and numerous tests. | Must not delete just because RTS uses `squads`. |
| `auto-guard` and `front-command` cards | Redundant large-screen presentation in RTS. | Hidden in RTS, preserved in classic. |
| `attack-control` card | Confusing for RTS because percentage-based national reserves do not represent an individual squad. | Hidden in RTS, preserved in classic. |
| `active-armies` list | Still useful for ongoing orders, including distant assaults. | Keep pending a dedicated RTS-only UX review. |
| `docs/qa/` screenshot evidence | Historical QA artifacts; not runtime modules. | Archive selectively after release instead of deleting proof of past visuals. |
| `scripts/rts-ai-activity.mjs` | Active reproducible AI activity diagnostic. | Retain for balance regression work. |

## Known limitations
- The new summary counts living soldiers in real RTS formations; “mobile” still reflects the existing reserve pool, not all fielded soldiers.
- The classic percentage controls remain accessible in other code paths, including keyboard shortcuts; they are merely hidden in RTS presentation.
- Full `npm test` and Docker build must be run on the user’s checkout. The connector commits code but does not execute the local Node test suite.
