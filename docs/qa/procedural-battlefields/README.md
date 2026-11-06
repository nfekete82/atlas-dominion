# Procedural battlefields — generator 1, 2026-11-06

Stacked on PR #239 / `feat/webgl-premium-desert-oases-20261106`, commit `d97da1a`.
Isolated worktree: `/private/tmp/sandforge-procedural-battlefields`.
Docker preview: **http://127.0.0.1:8132/**. Production 8095 and previews 8116/8128 were not changed.

## Architecture and version boundary

`generateMap()` remains the sole site/obstacle generator. New versions **23/24/25/26** retain the spacious 6240/6900/7440/7890 world sizes and 4/8/12/16 bastions. Versions 0–22 continue through their historical generation code. Sixty-nine fingerprints from the unmodified PR #239 cover generated geometry, blocked/opaque grids, sites, territory polygons, ownership and income for every historical ID with seeds 0, 2074 and 4294967295.

The Linux CI run exposed last-bit trigonometric differences between ARM and x86 in raw JSON hashes. The fixture retains the original exact hashes and additionally hashes geometry at 0.000001-unit precision across engines, while collision and opacity bytes remain exact. More strongly, `scripts/check-historical-battlefields.mjs` transpiles the **untouched source from immutable commit d97da1a** and compares all 69 complete geometry/navigation/economy hashes **without any rounding** against the feature on the same JS engine. That exact same-engine check is a mandatory CI step. All 69 exact comparisons and portable fixtures also passed locally under Linux/ARM64 and emulated Linux/x86 Node 22; 24 raw ARM/x86 hashes differed only across engines. [Runtime comparison records](historical-comparison.json). No runtime geometry or historical collision was altered to accommodate the test.

`battlefield-terrain.ts` precomputes a 225×225 Float32 heightfield on the existing 4×56 WebGL tessellation. Warped multi-octave value noise, curved dune crests, ridged relief, broad plateau masks and low basins produce continuous asymmetric landscapes. Named streams isolate profile choice, bastions, terrain, rock geometry, ruins and oasis basins; the existing independently seeded vegetation/detail renderers remain in use. No gameplay generator uses `Math.random()`.

`World.terrainHeight()` interpolates the actual mesh triangles, including their b–c diagonal. The renderer, actors, water, ground tracks, camera target, minimap and new high-ground predicate use that authority. No terrain noise is evaluated during a frame. The field occupies **202,500 bytes**, excluding its small metadata. The old canyon/hill samplers remain exclusive to old maps.

| Profile / URL | Terrain | Oasis target | Rock target before size adjustment |
| --- | --- | ---: | ---: |
| `open` | Broad low desert, sparse rock masses, long maneuvering space | 1 | 6 |
| `dunes` | Wind-oriented warped crests, connected wide valleys | 2 | 10 |
| `rocky` | Broad raised plateaus and eroded valleys, larger layered rock groups | 1 | 30 |
| `oasis` | Low rolling ground with reserved shallow basins | 5 | 10 |
| `mixed` | Continuous warped weighting of flat, dune and rocky zones | 3 | 22 |

These are weighted profiles, not square biome tiles. Targets are safety limited. The existing premium soil shader now sizes its uniform arrays for the actual oasis count, including the fifth grove; legacy capacities/program keys stay unchanged. Every world in the final 1000-world sample has at least one safe oasis. Water remains shallow and passable, matching the premium oasis design.

## Navigation, starts and combat

`campaignLayout(seed)` still assigns the actual four diagonal player/AI configurations. New HQ centers point outwards from their bastion according to the physical corner, rather than faction color. Both sides receive a 650-unit flat pad, broad shoulders and the same home/neighbor economic tiers. The seed-stress run found edge-biased starts on some initial candidates; candidate sites now reject inadequate border clearance before geometry is constructed. An explicit regression exercises all four starting orientations and both owners' actual HQ build locations.

The existing site graph reserves broad routes. Mesas and ruin footprints are rasterized by the existing World code. The new single merged rock mesh follows the exact solid mesa hulls; layered skirts fill their entire footprint. Old maps retain their existing rock rendering. New rock resources reuse the existing sandstone texture; palms remain shared instanced premium oasis assets. Oasis basins are reserved before obstacles and flattened before sampling their full footprint.

A lower-only gradient envelope limits terrain triangle gradients to <0.312 (about 17.3°). These are traversable slopes; solid rock groups create the impassable relief. Buildings additionally require a maximum 10-unit footprint height spread and slope ≤0.14. Flat starts offer comparable space without mirroring the whole terrain. High-ground eligibility requires walkable terrain, elevation ≥45 and gradient ≤0.20, excluding aircraft and solid cliffs. The existing +20% outgoing / −10% incoming modifiers are retained. Open Desert generally has no elevation bonus. Passable dunes retain the existing ground LOS rules; opaque rock masses continue to occlude vision. No extra height-based range or sight bonus was introduced.

`battlefield-validation.ts` uses the authoritative 240×240 World grid and a temporary **32-unit clearance** flood (larger than the real ground units). It verifies all bastions, both HQ pads, two available neighboring expansion directions per side, matching build area, and no isolated walkable cells. Invalid geometry retries at most three derived candidates, followed by a deterministic obstacle-free safety candidate with the same profile and sites. Complete geometry is replaced together with its collision; collisions are never silently erased beneath visible rocks. The fallback and deliberate blocked-route detection are tested. The final stress sample needed no retries.

## Menu, save games, fog and edges

The new-game dialog offers random plus five profiles. An empty seed draws a fresh cryptographic uint32. An explicit seed and profile reproduce the map; random profile choice is itself seeded. The resolved profile and seed appear in the existing status, document title and minimap tooltip, without enlarging the HUD.

The save envelope stays version 2. Only new map IDs require `terrainProfile` and `generatorVersion: 1`; the actual uint32 seed is already stored. Loading always regenerates the saved map ID and resolved profile, then restores gameplay state. Unknown generator/profile metadata is rejected. The continue menu reads the original version from the saved game, rather than assuming today's default. Historical seeded URLs without `terrain` or `play` retain v19–22; `legacy=1` retains v15–18. New menu games always include `terrain=random` or an explicit profile.

Minimap relief is baked once from the same height sampler and World collisions, with oasis positions overlaid below fog. Its dynamic fog uses the unchanged authoritative vision cells. The 16 WebGL fog sheets reuse the terrain geometries; camera viewport rotation, picking, edge clamps and black exterior masking retain the RC2 code.

## Automated acceptance

- Full `npm test`: **1185 pass, 0 fail, 1 existing optional premium infantry binary-assets skip** (1186 total).
- Eleven new Node tests cover historical fingerprints, deterministic and different-seed geometry, all five profiles, all four sizes/corners, both owners' HQ sites, exact triangle heights/gradients, real unit clearances/path segments, solid rocks, rejection/fallback, premium oases, high ground, save metadata and paid AI bootstrap.
- **1000 worlds**: 50 deterministic seeds × five profiles × four sizes. **0 errors**, 0 retries, 0 missing oases. All free cells are connected; every bastion is reachable at conservative tank clearance. Each side has at least 81 sampled 100-radius building footprints and two neighboring expansion directions. Observed generation median 59.5 ms, p95 128.0 ms, max 243.0 ms under concurrent local test load. [Full seed results](geometry.json).
- **40 real AI matches**, up to 420 simulation seconds each: all five profiles × four actual RED starting corners × 4/16 bastions. Every run builds HQ, produces and expands; no ground-unit samples inside blocked terrain. [Per-match results and observations](ai.json). BLUE is the passive ordinary startup, so these runs establish functional navigation/AI behavior, **not competitive faction balance**. The stall metric only counts persistent distant `move` orders; it is not a proof that every combat or support order is productive.
- **44 focused Playwright cases** pass against the corrected final Docker build, plus the **19 unchanged existing browser regressions** (63 total cases in the final CI gate). The initial combined 28-case local suite passed; Linux software WebGL exposed that six screenshots or multiple complete reloads shared one 45-second budget. The new focused cases preserve every assertion/view, reuse each paused full-detail scene and keep the same 45-second per-case limit. Metadata-only menu/resume cases consistently use the selected lightweight graphics preference. No existing test was removed or relaxed. Includes the compiled five-oasis soil uniform capacity and same-camera two-seed comparison. Includes new terrain and unchanged oases, fog/minimap, rotated camera, black edge/picking, HUD responsiveness, menu, movement/commands, building/production UI and save/resume cases. No JS/shader errors in profile acceptance.
- Real Chrome process restart with a persistent on-disk browser profile: v19, v23/rocky and v26/oasis preserve seed, full geometry, collision and exploration exactly. [Restart results](persistence.json).
- Dedicated push/PR GitHub Actions workflow runs the full Node/1000-world/40-match gate and two independent Docker/Chromium jobs (44 focused cases and 19 unchanged regressions), then uploads evidence. CPU and browser jobs each retain the original 30-minute limit; no timeout increase hides a failed check. Remote links are recorded in the PR.

## Visual review and polish

[33 actual Docker WebGL screenshots](screenshots/) ([review contact sheet](visual-review.jpg)) include six views per profile (startup with fog, standard zoom, maximum zoom-out, rotated camera, central close view and minimap) plus same-size/identical-camera dune seeds 2074 and 2075, and a close view of the corrected fifth oasis soil mask. The seed comparison also asserts >15 units mean absolute heightfield difference.

The independent polish pass reduced the baked dune lighting in the historical sand artwork for new versions only: real terrain normals now describe relief instead of painted hills dominating all five maps. It also tightened rock rings inside their physical hulls, introduced irregular layered elevations, and used the complete two-axis slope for rock/sediment tinting. Old map artwork is unchanged. The black edge uses the existing monotonic RC2 fade and cover, with no distant lit sand beyond it.

| Profile | Startup | Standard | Max out | Rotated | Central | Minimap |
| --- | --- | --- | --- | --- | --- | --- |
| Open | [view](screenshots/open-start.png) | [view](screenshots/open-standard.png) | [view](screenshots/open-max-out.png) | [view](screenshots/open-rotated.png) | [view](screenshots/open-central.png) | [view](screenshots/open-minimap.png) |
| Dunes | [view](screenshots/dunes-start.png) | [view](screenshots/dunes-standard.png) | [view](screenshots/dunes-max-out.png) | [view](screenshots/dunes-rotated.png) | [view](screenshots/dunes-central.png) | [view](screenshots/dunes-minimap.png) |
| Rocky | [view](screenshots/rocky-start.png) | [view](screenshots/rocky-standard.png) | [view](screenshots/rocky-max-out.png) | [view](screenshots/rocky-rotated.png) | [view](screenshots/rocky-central.png) | [view](screenshots/rocky-minimap.png) |
| Oasis | [view](screenshots/oasis-start.png) | [view](screenshots/oasis-standard.png) | [view](screenshots/oasis-max-out.png) | [view](screenshots/oasis-rotated.png) | [view](screenshots/oasis-central.png) | [view](screenshots/oasis-minimap.png) |
| Mixed | [view](screenshots/mixed-start.png) | [view](screenshots/mixed-standard.png) | [view](screenshots/mixed-max-out.png) | [view](screenshots/mixed-rotated.png) | [view](screenshots/mixed-central.png) | [view](screenshots/mixed-minimap.png) |

Fifth oasis soil blend: [close view](screenshots/oasis-fifth-soil.png).

Same camera: [dune seed 2074](screenshots/dunes-seed-2074.png), [dune seed 2075](screenshots/dunes-seed-2075.png).

## Performance and limits

Browser: Chrome / ANGLE Metal **Apple M5 Max**, 1440×900, same seed 2074, .59 zoom, fog off, paused, terrain-centered or 96 visible mixed units at the start. Reference is the existing PR #239 Docker container on 8128. [Initial complete 24-scene comparison](browser-performance.json). Normal terrain medians are 16.7 ms in all profiles and both sizes. The intentionally dense 96-unit full-model scene exposes the inherited tens of thousands of model draw calls and roughly 12–15 FPS; it must not be presented as a 60-FPS large-battle result. [Three repeated final Docker measurements per 16-bastion profile/scene](browser-performance-repeat.json) ran after all other browser tests finished and waited for model loading to settle.

The new terrain uses the same 16 chunks and normal/base-color resources; one merged mesh renders all physical rock formations. Static 16-bastion draw calls in the initial comparison are 220 reference versus 234–236 procedural (about 6–7% more); triangle counts depend on visible profile/oasis geometry. Instanced oasis frequency naturally changes submitted palm triangles. The single-pass reference/new 96-unit medians vary with VSync scheduling, including one 83.3 ms mixed sample; the final repeated measurement with the corrected five-grove shader puts all profile medians at 66.6–66.7 ms and p95 at 66.7–66.8 ms. The initial single-pass variability is retained in the raw report, not hidden by the repeated medians. RAF times are display-synchronized, not uncapped GPU times; Three.js counts do not measure total GPU memory.

Final 16-bastion results (median across three runs, all 96 detail models loaded):

| Scene | Reference | Open | Dunes | Rocky | Oasis | Mixed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Terrain median frame, ms | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 | 16.7 |
| Terrain calls | 220 | 234 | 235 | 234 | 235 | 234 |
| 96-unit median frame, ms | 66.7 | 66.7 | 66.6 | 66.7 | 66.7 | 66.7 |
| 96-unit p95 frame, ms | 66.7 | 66.7 | 66.7 | 66.7 | 66.8 | 66.7 |
| 96-unit calls | 33,709 | 32,822 | 32,829 | 33,000 | 32,921 | 32,823 |

[48 CPU simulation comparisons](simulation-performance.json) use the **actual unmodified PR #239 module** against the feature, with matching seeds/settings and four starting orientations. Mean AI planning and process CPU did not regress in the 180-second sample. On 16 bastions, average CPU per match was 915 ms reference versus 536–650 ms across profiles; average tick p95 was 0.425 ms versus 0.365–0.438 ms. Different maps produce different trajectories, so this is a gameplay workload comparison, not identical-state proof. Long sessions, other GPUs and competitive win-rate balance are not established by this acceptance.

## Reproduce locally (macOS)

The following uses a new directory, a unique container name, and a port that must be free. It refuses a port conflict instead of stopping anything already running.

```sh
(
set -eu
repo="https://github.com/nfekete82/atlas-dominion.git"
branch="feat/webgl-procedural-battlefields-20261106"
preview_port=8134
preview_dir="$(mktemp -d "${TMPDIR:-/tmp}/sandforge-battlefields.XXXXXX")"
preview_name="sandforge-battlefields-$(date +%s)"
if lsof -nP -iTCP:"$preview_port" -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port $preview_port ist bereits belegt; preview_port auf einen freien Port ändern."
  exit 1
fi
git clone --depth 1 --single-branch --branch "$branch" "$repo" "$preview_dir"
cd "$preview_dir"
docker build -t "$preview_name" .
docker run -d --name "$preview_name" -p "127.0.0.1:$preview_port:8095" "$preview_name"
open "http://127.0.0.1:$preview_port/"
)
```

Targeted commands:

```sh
npm ci
npm test
node scripts/check-historical-battlefields.mjs
node scripts/stress-procedural-battlefields.mjs geometry
node scripts/stress-procedural-battlefields.mjs ai
npm ci --prefix tests/browser
ATLAS_BASE_URL=http://127.0.0.1:8132 tests/browser/node_modules/.bin/playwright test \
  --config=tests/browser/playwright.config.mjs tests/browser/webgl-procedural-battlefields.spec.mjs --workers=1
node scripts/test-battlefield-persistence.mjs
BATTLEFIELD_BASE_URL=http://127.0.0.1:8132 node scripts/benchmark-procedural-browser.mjs
# Point to a separately built, unchanged PR #239 checkout for the CPU reference:
BATTLEFIELD_REFERENCE_MODULE=/path/to/oasis-worktree/dist/src/reborn/simulation.js \
  node scripts/benchmark-procedural-simulation.mjs
```

Visual deep link: `http://127.0.0.1:8132/?bastions=16&seed=2074&terrain=rocky&pause=1&fog=off`.
Use `terrain=open|dunes|rocky|oasis|mixed|random`; remove pause/fog parameters for regular play.
