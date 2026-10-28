# Gameplay update · 2026-10-28

Source base: `8a5531e` (`feat/sandforge-compact-minimap-ui-20261028`). The checkout differed from the older branch/path in the task attachment. Existing local branding, compact-card CSS and its assertion were preserved unchanged in checkpoint `f5b4c35`. All implementation and validation ran in the supplied checkout.

## Shipped behavior

- A shared `role-visuals.ts` draws white rifle/cross/hammer paths in blue `#277fce`, green `#269b62`, yellow `#d69d1c` circles. World badges use 10 CSS pixels and ranks 8; separate cached 28-pixel menu canvases display at 14 CSS pixels (12 for small buttons). Portrait generation keeps complete silhouettes; all cards use `contain`. The former 24×24 square/font overlays are removed. Cards, queue, context production, quick production and selection use the same badges.
- Cumulative XP is part of the real unit/save object, including embarked passengers. Thresholds: 0 / 100 / 250 / 500. Damage awards 0.1 XP per applied HP and kills 20; healing 0.25 per applied HP, repair 0.2, construction 2 per applied build-second and completion 20 shared among contributing builders. Self-healing awards none. Visual work events never grant XP. Building cancellation grants no extra XP; completed work already earned remains. A per-tick ID map resolves missile sources without scanning units per hit.
- Rank bonuses come from frozen role tables, without altering `UNITS` or max HP. Infantry fire rate +8/12/16%, damage +0/8/12%; medic healing +10/15/20%, reach +0/10/15%; engineer repair +10/15/20%, construction +0/10/15%. Vehicles/aircraft receive +4/6/8% fire rate and +0/3/5% damage. Existing burst spacings and the 1.5× shared-construction cap remain. UI shows ranks, cumulative XP, next threshold, progress and bonuses. Damaging hits clamp HP to zero; only the hit's actual remaining HP earns XP.
- `weather.ts` uses its own seeded integer hash and simulation time. First warning after 180–260 seconds; warning 12 seconds; storm 40–70; recovery 10; calm 150–240. Timings and effects live in `WEATHER_RULES`. Neither wall time nor simulation/AI RNG drives weather. Seed + saved simulation time reconstruct every phase and deadline, including legacy saves, without replaying notifications.
- Storms reduce mobile ground sight to 65% and aircraft movement to 80%. Fixed building/bastion sensors retain their existing ranges. Ground target acquisition uses the same reduced sight, including the direct-sight fallback. Both factions share the implementation. Phase changes invalidate/recompute vision immediately; no terrain/path regeneration. Existing AI observations continue through faction visibility and remembered intelligence.
- Artillery gets a deterministic 6.3–18 metre aim offset per projectile; the actual impact position/damage persists in flight. AoE XP uses each victim's applied damage. Existing projectile flight, transports and fog filtering remain.
- Weather presentation uses one cached 256×128 haze canvas and at most 84 fine sand streaks, restricted to currently visible ground. Fade ramps follow simulation time; paused animation freezes. Reduced Motion or disabled particles leaves static atmospheric tint. Wind reuses the existing filtered ambient loop and audio gain, with smooth storm swells, master/ambience settings and pause/visibility gating. No duplicate sources on load; normal browser audio unlocking remains.

## Files

Runtime: `index.html`, `src/reborn/{config,main,renderer,simulation,audio,retro-desert.css}`, new `role-visuals.ts`, `veterancy.ts`, `weather.ts`, `weather-presentation.ts`.

Tests: new `tests/reborn-veterancy.test.mjs`, `tests/reborn-weather.test.mjs`, `tests/browser/reborn-gameplay-update.spec.mjs`; `tests/browser/reborn.config.mjs`; `tests/reborn-defense-map.test.mjs` now verifies zero recruit XP separately before hashing the otherwise unchanged legacy geometry. All original geometry hashes and strict assertions are retained.

Measurement: `scripts/benchmark-gameplay-weather.mjs`, `docs/performance/gameplay-update-{baseline,after}.json`, this report and raw test logs. The initial checkpoint also includes the three pre-existing edited files (`sandforge-brand.js`, `retro-desert.css`, `reborn-compact-ui.spec.mjs`). No GLB, atlas, terrain asset, dependency or map-generation code changed.

## Verification

- `npm run build`: PASS.
- Final `npm test`: **747 PASS, 0 FAIL, 1 SKIP** (748 tests); full output in `node-tests.txt`.
- New tests cover thresholds/caps, damage/overkill/kills/bursts, heal/self-care, repair/build/completion, both factions, invalid/old saves, cargo, seeded replay, warning/pause, vision/cache/hidden enemies, aircraft movement, artillery/AoE, missile save/load and real storm transport boarding/unloading.
- Feature browser suite: **3/3 PASS**, including 1280×720, 1440×900, 1920×1080 at DPR 1 and 2, exact badge colors/vector pixels, consistent sizes, proportional portraits, queue/quick/context badges, sidebar bounds, XP UI, storm HUD/fog/pause, audio-source reuse and Reduced Motion. Screenshots are generated under `tests/browser/artifacts/gameplay-update`.
- Entire configured browser suite: **73 PASS, 11 FAIL** (84 tests). No old assertion was relaxed to hide failures. Raw output: `browser-full.txt`.
- Docker Compose config/build: PASS. Built image `sha256:55ff51b44a00e178b1fa4292d3478f6418d48254116f9d8ac489fc2c45e41b07`; ephemeral test container returned HTTP 200 for the page and all three new runtime modules. Test container was stopped; existing containers were not replaced. Port 8096 was already occupied, so Docker assigned a free test port (32768).

## Browser limitations and baseline audit

The existing browser suite has stale assertions against newer work already in the checkout: preserved move/retaliation orders; marching fire; first-target behavior; panel widths/heights (the current strip is 820×168); absent legacy minimap labels; and old vehicle-color/layer expectations. The tank-blue coverage test measures 2.14% against an older 6% expectation. Its failure, and the audio test's full-screen tactical-pause interception timeout, reproduce using TypeScript compiled directly from `8a5531e` with the same assets.

The infantry pose test also fails at baseline (62-pixel body height versus >70). With role annotations, its connected-component test additionally counts the intentionally separate badge as a detached object. The unchanged sprite layer remains covered by the passing animation and presentation tests. No models or animation atlases were edited to satisfy obsolete assumptions.

The new-campaign test uses an unseeded map and sometimes fails its 650-metre spacing assertion; a baseline rerun passed. Map-generation sources are unchanged. Baseline evidence includes one interrupted comparison: the temporary comparison HTTP server originally mishandled a missing resource; its connection-refused cases are **not** treated as product failures. The remaining affected tests were rerun after fixing that temporary server (`browser-baseline-remaining.txt`).

Optional promotion particles and spoken promotion callouts are not implemented. Weather warnings use the existing radio-message HUD; wind uses existing procedural ambience. XP uses finite nonnegative values capped at 1e9, while rank bonuses stop at Held. Long-term balance tuning beyond regression tests remains future work.

## Measured performance

Chrome 156.0.8078.73, 1440×900, DPR 2, 4× CPU throttling, seed 2026, five-second samples using the existing `PerformanceRecorder` and `setupScenario`. Raw measurements include exact browser version, samples, phase timings and path counts. This is a smoke comparison, not a hardware-independent FPS guarantee.

| Scenario | Baseline frame P95 | Update frame P95 | Update simulation mean |
| --- | ---: | ---: | ---: |
| 50 moving units, clear | 16.7 ms | 16.8 ms | 1.92 ms |
| Combined army/air/turret battle, clear | 550.0 ms | 516.7 ms | 11.95 ms |
| Combined battle, sandstorm | unavailable | 533.4 ms | 4.03 ms |

The combined battle is already extremely slow at these deliberately heavy browser settings (baseline 14 frames / update 11 frames in five seconds), dominated by existing sprite/corpse rendering. Do not infer a speedup from that small sample. Storm rendering does not regenerate terrain/textures, spawn new world entities, or trigger continuous path rebuilds. The 50-unit sample remains close to baseline. The heavy-battle bottleneck remains a known limitation.

Reproduce with a preview server running: `ATLAS_BASE_URL=http://127.0.0.1:8095 node scripts/benchmark-gameplay-weather.mjs gameplay-weather`.
