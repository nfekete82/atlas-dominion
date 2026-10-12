# Naval Warfare 2.0 / real Europe topography — QA, 2026-10-12

Implemented on `feat/organic-front-map-ui-20261012` for [PR #28](https://github.com/nfekete82/atlas-dominion/pull/28). The original untracked root `package-lock.json` was preserved and excluded from the commits. Existing labels, city marker styling, city defense and increased city upgrade prices remain in place. The additional peaceful-opening commits that arrived during implementation were incorporated.

## Behavior and files

- `src/engine/navigation.ts`: shared geographical ocean/coast caches, deterministic multi-source water BFS, bounded per-game fields, valid connected target regions, geodesic route lengths and 8–96-tick outward travel. `src/data/navigation-barriers.ts` excludes actual non-playable African/Asian land. No route can wrap a row, leave the map, cross land interiors or use an enclosed lake.
- `src/engine/game.ts`: automatic normal-click naval fallback with land/counterattack priority, once-only reserve transfer, live in-transit armies, arrival-gated combat, cancellation/return travel, changed ownership handling, stranded-army losses after complete national elimination, deterministic additive version-1 saves and migration of older fixed-crossing voyages. Survivors return to the national mobile reserve after the return duration; this is the same aggregate reserve model used by land campaigns. If the original port was lost while the nation still lives, the simulation demobilizes the returned expedition into that national reserve rather than creating a territorial landing at the hostile port.
- AI evaluates sea opportunities even with available/active land expansion, on staggered planning ticks. One fleet and two total campaigns per nation; real expedition strength and home reserve requirements; scoring includes defenses, relative strength, distance, city resources/upgrades, income and already committed invaders. Existing peaceful opening, staggered war windows, neutral preference and anti-dogpile scores remain. A hard entry limit additionally prevents a third AI nation joining an invaded target.
- `src/render/sea-voyages.ts`, `src/render/map.ts`, `src/main.ts`, `index.html`: actual route-following boats, cached paths, small faction-colored markers, subtle dashed sea routes, overlap separation, pause/reduced-motion stability and ordinary-click instructions. Cosmetic land reinforcement effects are suppressed for departing fleets.
- `src/render/topography.ts`, `src/data/topography.ts`, `src/assets/*`, `scripts/generate_topography.py`: real Natural Earth hillshade and 988 lake features, projected to the existing map and cached at DPR 2 below all city/name/front/HUD elements. Original territory colors remain readable. `scripts/build.mjs` packages assets; `scripts/serve.mjs` serves PNG with the correct MIME type. Sources, licenses, source hashes and reproduction: [GEODATA.md](../../GEODATA.md).
- `tests/naval.test.mjs`, `tests/naval-simulation.test.mjs`, `tests/topography.test.mjs`, `tests/browser/naval.spec.mjs`: new engine, geography, long-run and actual browser coverage. Existing `tests/front-combat.test.mjs` now requires real coasts rather than treating a northern Cyprus political boundary as a port. `tests/casualties.test.mjs` explicitly strengthens its defender: the peaceful-opening change had removed its accidental dependency on an AI counterattack (confirmed by reproducing the failure with unchanged `cecbfe1` game code).

## Actual validation

`npm test`: **188 passed, 0 failed**, including the existing unit/integration suite and long-run balance tests. Final local run: 35,033.53 ms. `git diff --check` and TypeScript typechecking passed.

`ATLAS_BASE_URL=http://127.0.0.1:8095 npm run test:browser`: **40 passed, 0 failed** in about 1.2 minutes, against the rebuilt Docker application in real local Chrome. The same 40-case suite also passed on the temporary source server on port 8096. Includes original 33 city/UI cases and 7 new naval/topography cases. Required 1440×900 and 1920×1080 were checked at DPR 1/2; existing cases additionally cover 2560×1440, zoom 100/150/200/400%, and 768×1024 at DPR 3. Normal mouse clicks really launch boats, deducted reserves are asserted, pause keeps state fixed, browser reload preserves exact voyage state, and ownership only changes on arrival. Reduced Motion is emulated and the fleet remains visible.

Six additional complete balanced simulations, each with 49 AI nations and deterministic halfway-save replay:

| Seed | Ticks completed | Naval expeditions observed | Peak simultaneous fleets | Maximum distinct invaders per target |
| --- | ---: | ---: | ---: | ---: |
| 20261012 | 500 | 61 | 7 | 2 |
| 20261012 | 1000 | 138 | 7 | 2 |
| 20261013 | 500 | 52 | 5 | 2 |
| 20261013 | 1000 | 105 | 5 | 2 |
| 20261014 | 500 | 69 | 7 | 2 |
| 20261014 | 1000 | 136 | 7 | 2 |

All remained `playing`, conserved population ledgers, kept finite nonnegative reserves and matched resumed future saves exactly. Each AI retained at most one sailing fleet. The inherited balanced/intense 1000-tick and relaxed 500-tick replay checks also passed. [Exact simulation measurements](simulation-results.json) · [Test summary](test-summary.json).

## Screenshots opened and visually inspected

The paired overview uses identical paused gameplay state with the display layer disabled/enabled. The original deployed pre-change capture is also retained. Ship/city/combat cases deliberately use controlled fixtures to make the required states reproducible; they are not claims about natural territorial growth.

- [Original deployed map before the changes](before.png).
- [Same-state overview before relief](overview-before.jpg) / [after relief](overview-after.jpg).
- [Alps, Bodensee/Constance, Geneva, Garda and Balaton](alps-constance.jpg).
- [Scandinavian mountains and real Swedish/Finnish lakes](scandinavia-lakes.jpg).
- Britain/Ireland mid-voyage: [1440 DPR 1](fleet-1440-dpr1.jpg), [1440 DPR 2](fleet-1440-dpr2.jpg), [1920 DPR 1](fleet-1920-dpr1.jpg), [1920 DPR 2](fleet-1920-dpr2.jpg).
- [Fleet with Reduced Motion](fleet-reduced-motion.jpg).
- [Cities, active fronts and country names together](cities-fronts-labels.jpg); [all six city tiers at DPR 2](city-tiers-dpr2.jpg).

Initial relief highlights were too strong in the first actual screenshot; opacity was reduced to 65% of the capped raster alpha (maximum effective relief opacity about 11.7%). Lakes remain more apparent, with quiet blue-gray fill. No relief crosses the rendered ocean. Boat routes and faction markers are small and readable, and city names, large country labels and combat counters retain their priority. No generated illustration is used as geographic evidence.

## Performance and limits

[Measured browser timings](performance.json), at 1920×1080 with **100 parallel fleet markers**: baseline and relief frame medians both **16.7 ms** (~60 Hz); relief frame P95 **16.7 ms**; fleet drawing median **0.2 ms**, P95 **0.3 ms**. The separate 1500-city check recorded frame median 16.7 ms, P95 16.8 ms and city-layout P95 0.3 ms. 100 cached route requests took **3.01 ms** locally. Full-game simulation median tick times were 2.37–2.73 ms and P95 6.63–8.91 ms in the recorded final run. These are local observations, not a cross-device performance guarantee.

Static relief adds a ~2.8 MB compressed asset and a 3200×1800 cached canvas (~23 MB RGBA storage); lake linework is cached instead of traversed every frame. Fleets use weakly cached route geometry and paths. Coast-field caches are bounded to four entries per game. No map scan is added per fleet per frame or per simulation tick.

Routes are shortest in four-neighbor raster steps; actual segment kilometers determine travel and visual interpolation. This is not continuous-space navigation or an exact globally shortest geodesic solver. The existing 480×260 raster and low-resolution playable outlines limit small islands/straits; non-playable geographical land is blocked. The renderer clips detailed relief to those existing simplified outlines. Travel duration is deliberately capped for gameplay. Fleet positions advance on the authoritative 250 ms simulation ticks, including with Reduced Motion. Separate physical Retina hardware, Safari and Firefox were not tested. Optional river drawing was omitted to preserve readability.

## Docker and git

Only `docker compose build atlas-dominion` and `docker compose up -d --no-deps atlas-dominion` changed a service. Atlas is running at **http://localhost:8095**, with HTTP 200 and PNG assets served correctly. Other container IDs, exact start timestamps and restart counts were compared before/after and are unchanged: `mlx-web`, both Panda Ape Adventure services and `searxng`.

Implementation and geodata are committed separately on the existing feature branch and pushed to PR #28; no merge to `main` is performed. Remote CI status is verified after the push and recorded in the final response.
