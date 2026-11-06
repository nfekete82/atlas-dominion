# Premium desert oases — 2026-11-06

Feature branch: `feat/webgl-premium-desert-oases-20261106`.
Base: `fix/webgl-edge-vision-minimap-sync-20261106` at `6e2de60` (RC2, downstream of `feat/webgl-default-rc2-20261106`). No merge or deployment.

## Implementation

- Three seeded types: shallow water oasis (3–6 palms), dry grove (2–5), semi-dry remnant pool (2–4). Four-bastion maps target three; larger maps target 2–4 based on area. All candidates can be rejected rather than forced onto unsafe ground.
- Separate pure layout generator, terrain/water materials and scene/resource owner. Local Three.js import map and existing build/Docker packaging; no CDN, downloaded assets, new dependencies or texture allocations.
- Seeded multi-frequency outlines blend damp sand, sediment, fine fractures and roughness directly into the existing textured PBR ground shader. Thus there is no soil decal, separate soil surface, terrain height edit or circular mesh seam.
- Transparent muddy teal water uses the exact terrain vertex lattice and triangle diagonals, offset by only 0.20 world units. Its shoreline is evaluated continuously in the fragment shader. Gentle animated normals, roughness and Fresnel highlights require no reflection passes. It represents a thin, fordable film over sand, not a lake or navigation barrier.
- Three shared procedural date-palm geometries with curved trunks, raised leaf scars, curved rachises and individual tapered lanceolate leaflets. Instances vary height, heading, lean and color; no rectangular foliage cards. Sparse reeds, dry grass, shrubs and irregular weathered stones use instancing and shared materials.
- Replaces the previous unvalidated, expensive cloned palm groves near ruins. Existing unrelated terrain dressing and historical border palms remain. Also corrects the existing `borderPalms` block scope issue, which previously made the asynchronous grove loader reject after creating its meshes.
- Safety margins cover full footprints: edges 180 + 1.35 radii, sites 340 + 1.35 radii, start regions their radius + 180 + 1.35 radii, main roads 150 + 1.35 radii, ruin half-diagonal + 100 + 1.35 radii, inter-oasis 400 + both 1.35 radii. Full footprint samples reject blocked cells and gradients above 1/8.
- No simulation/navigation/save changes. Construction remains possible everywhere it previously was. Buildings reclaim intersecting decoration and its soil/water at a throttled visual occupancy check (also on restored saves); removing a building restores the seeded appearance.
- GPU water animation updates only time uniforms per frame. Owned geometry, materials, instance buffers and terrain shader hooks have idempotent disposal; page navigation triggers disposal without breaking back-forward cache.

## Verification

- Full `npm test`: **1174 passed, 0 failed, 1 existing optional premium-infantry binary-assets test skipped**, 1175 total. Missing optional local premium infantry binaries are unrelated to oases.
- Six new Node tests: 4/8/12/16 bastions × seeds 0/1/2026/2074/4294967295, identical seeds, seed variation, counts, safe footprints, finite coordinates, unchanged navigation, blocked-map rejection; save round trips across historical v15–18 and current v19–22.
- Eleven Playwright tests pass against both source build (8127) and isolated Docker build (8128): five new oasis cases plus six existing fog/edge/minimap/HUD cases. Check real water/palm meshes, continuous triangle interior ground contact (error < .003), soldier travel across a pool, untouched saves/navigation, default fog, construction reclamation and repeated resource disposal.
- Six additional existing playable WebGL tests pass in Docker: assets, fog, production/build menus, actual mouse commands and movement, drag selection, save/resume, portraits, terrain texture provenance.
- Visual audit: ten screenshots from the shipped Docker build, reviewed at close/standard/minimum zoom, rotated and shallow allowed angles, and all three oases on a 16-bastion map. No browser JS or shader errors. A polish pass widened the original overly fine palm leaflets, tuned soil/water color and replaced the initial resampled water surface with exact terrain triangles.
- New GitHub Actions workflow builds Docker, runs the full Node suite and focused Chromium regressions, and uploads browser artifacts. CI software rendering must not be interpreted as native Mac GPU performance.

## Performance

Local headless Google Chrome, 1440×900, paused seed 2074, fog visually off, identical focused camera at zoom 1.55. Renderer identifies `ANGLE (Apple, ANGLE Metal Renderer: Apple M5 Max, Unspecified Version)`. These are browser requestAnimationFrame intervals, display-synchronized, not uncapped GPU timings; short samples cannot prove long-match or all-hardware performance. The authoritative A/B data is [performance-comparison.json](performance-comparison.json). Three.js counts include the renderer's shadow work.

The initial before/after snapshots ([baseline.json](baseline.json), [after.json](after.json)) use the unchanged spawn camera. They show 2381 → 1323 calls and 838 → 779 allocated geometries, primarily from replacing the old cloned groves. They are historical snapshots, not a controlled GPU benchmark. Focused A/B figures below isolate the new oases by toggling `oases=off` on the same final build.

| Map | Oases | Calls | Triangles | Geometries | Textures | Median / p95 frame ms |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| 4 bastions | on | 174 | 333472 | 814 | 86 | 16.60 / 17.40 |
| 4 bastions | off | 163 | 252246 | 803 | 86 | 16.60 / 18.50 |
| 16 bastions | on | 52 | 321808 | 901 | 89 | 16.70 / 17.60 |
| 16 bastions | off | 41 | 230632 | 890 | 89 | 16.70 / 17.50 |

The oasis geometry attribute/index arrays total approximately 1.20 MiB; this excludes driver overhead, instance matrices and shared renderer buffers. Actual total GPU memory in bytes is not exposed by Three.js. No added textures. Instancing bounds span groves, so some offscreen palm triangles are submitted; this is an intentional tradeoff for low draw calls.

## Visual evidence

| View | Screenshot |
| --- | --- |
| Water, close | [water-close.png](water-close.png) |
| Water, standard zoom | [water-standard.png](water-standard.png) |
| Water, maximum zoom-out | [water-max-out.png](water-max-out.png) |
| Dry grove | [dry-close.png](dry-close.png) |
| Semi-dry | [semi-close.png](semi-close.png) |
| Rotated | [water-rotated.png](water-rotated.png) |
| Shallow angle | [water-low-angle.png](water-low-angle.png) |
| 16-bastion water / dry / semi-dry | [water](large-water.png), [dry](large-dry.png), [semi-dry](large-semi.png) |

Oases on the larger map are documented in separate views: their safety spacing and the permitted minimum camera zoom prevent a useful single close shot of every grove. [layouts.json](layouts.json) records their actual coordinates.

## Local preview and reproduction

The isolated container `sandforge-premium-oases-20261106` serves `http://127.0.0.1:8128`. Production 8095 and existing preview 8116 were left unchanged. Preview links:

- Water: `http://127.0.0.1:8128/?bastions=4&seed=2074&oasis=water&pause=1&fog=off`
- Dry: replace `oasis=water` with `oasis=dry`.
- Semi-dry: `oasis=semi`.
- Default fog/gameplay: omit `fog=off` and `pause=1`.
- Large map: `bastions=16`.

Fetch into another isolated worktree and build a fresh preview on a free automatically allocated host port (Docker Desktop or OrbStack must be running):

```sh
cd "$HOME/Projects/sandforge-bastion-wars"
git fetch origin feat/webgl-premium-desert-oases-20261106
git worktree add --detach "$HOME/Projects/sandforge-oases-review" origin/feat/webgl-premium-desert-oases-20261106
cd "$HOME/Projects/sandforge-oases-review"
docker build -t sandforge-premium-oases:review .
OASIS_CONTAINER="sandforge-oases-review-$(date +%s)"
docker run -d --name "$OASIS_CONTAINER" -p 127.0.0.1::8095 sandforge-premium-oases:review
OASIS_PORT="$(docker port "$OASIS_CONTAINER" 8095/tcp | sed 's/.*://')"
open "http://127.0.0.1:${OASIS_PORT}/?bastions=4&seed=2074&oasis=water&pause=1&fog=off"
```

Reproduce tests/audits in that worktree after `npm ci` and `npm ci --prefix tests/browser`:

```sh
npm test
ATLAS_BASE_URL="http://127.0.0.1:${OASIS_PORT}" tests/browser/node_modules/.bin/playwright test --config=tests/browser/playwright.config.mjs tests/browser/webgl-oases.spec.mjs tests/browser/webgl-fog-alignment.spec.mjs tests/browser/webgl-hud-responsive.spec.mjs tests/browser/webgl-playable.spec.mjs --workers=1
ATLAS_BASE_URL="http://127.0.0.1:${OASIS_PORT}" node scripts/oasis-visual-audit.mjs
ATLAS_BASE_URL="http://127.0.0.1:${OASIS_PORT}" node scripts/oasis-performance-audit.mjs
```

Known limits: no reflection render target, no deep/blocked water, no new gameplay bonuses or colliders; palm wind animation is intentionally omitted. Legacy maps below v15 have no premium oases. Long-session GPU driver memory and uncapped GPU timings were not measured. Geometry-based trunk scars replace external bark textures. Original world height, sand artwork, HUD, camera, fog and minimap are retained.
