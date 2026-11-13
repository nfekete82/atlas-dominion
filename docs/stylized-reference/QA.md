# Executed quality checks · 2026-11-13

This records executed checks, not intended future checks.

| Check | Result |
| --- | --- |
| `npm run build` | Passed; TypeScript and standalone distribution built |
| `npm run assets:stylized:check` | Passed; byte-identical regeneration and Khronos validation of all six GLBs |
| Khronos glTF-Validator 2.0.0-dev.3.10 | 0 errors, 0 warnings per GLB; rover muzzle is an intentional empty attachment node reported as informational |
| `node --test tests/stylized-pack.test.mjs` | 11 passed, 0 failed |
| `npm run test:building-design` | 98 passed, 0 failed |
| Existing `webgl-building-design-system.spec.mjs` in Chrome | 2 passed; gallery/biomes and all-facility construction/four-facing infantry release |
| `scripts/verify-stylized-browser.mjs` in Chrome | Passed; structured evidence in `qa/browser-results.json`; no captured page or shader errors |
| Full Node suite, concurrency 4 | **Not green:** 1,642 tests, 1,610 passed, 31 failed, 1 skipped |

The full suite was compared with a separate `/tmp` copy of the original
`de365110` scripts/tests and tracked fixtures. Unchanged `src` and built `dist`
were shared by symlink. That baseline run had 1,630 tests, 1,597 passed,
32 failed and 1 skipped, including a whole-file `reborn-combat-index` runner
failure. All 31 failing names in the changed run also occur in that baseline.
No new failing test names remain. Baseline used Node's default concurrency;
the final run used 4, so this comparison does not establish equivalent timing
or performance. See `qa/regression-comparison.json` and the summary files.

Existing failures include older scale/decor source assertions, AI/gameplay
expectations and local server tests blocked by restricted port binding. They
are not silently changed to claim a green overall suite. The one construction
source assertion affected by adding single-model barracks was updated to cover
that behavior; actual construction is also verified with loaded GLBs and in Chrome.

## Browser checks

- All three new references load through the production game adapter at the
  same scale of 18 world units/metre, including lightweight mode.
- Compare all three references in the same orthographic camera/light rig:
  `reference-blue.png`, `reference-red.png`, `rts-distance.png`.
- Inspect jeep proportions, glass, camouflage, tyres and rig in `rover-detail.png`.
- Inspect soldier rest pose and sampled Walk/Run/Shoot/Death poses in the
  corresponding `infantry-*.png` images. The runner does not claim exhaustive
  frame-by-frame validation, all-terrain foot planting or commercial art approval.
- Open the barracks' actual leaves and inspect its passage in `barracks-open.png`.
- Load a real battlefield, arrange the three authoritative entities in a
  walkable clear area, and render `live-game.png`. Only this QA arrangement
  disables the fog overlay; normal game fog behavior is unchanged.
- Confirm triangle-based construction reveals the new barracks progressively.
- Produce the real infantry actor and sample its departure through the
  opening in all four rotations. Confirm it remains centred through the wall,
  the door opens before visibility, closes afterward and simulation-unit data
  stays unchanged during the presentation samples.
- Move the real rover presentation and confirm Drive turns its wheels; an
  unchanged position with `moving=true` switches to Idle and wheels stop.
- Switch barracks ownership and compile its selective team repaint shader.
- Kill the real soldier and verify the retained corpse plays Death to its
  final hips height/rotation rather than using the legacy instant rotation.
- Intentionally reject one new GLB in the loader and confirm that the original
  animated legacy infantry model loads as fallback.

## Limits

The new reference gallery submits 18 visible primitives including its ground
in the sampled combined view. This is not a large-army FPS benchmark. No claim
is made for a new LOD system, full roster migration, new environment assets,
smooth skinning/IK, baked AO maps or rebuilt HUD portrait artwork. Those remain
explicit follow-up work. Screenshots demonstrate the current results and are
the review basis for further art iteration.
