# HQ3 reference surfaces

These seven JPEGs are byte-for-byte copies of embedded images 0–6 of the user-provided `../sandforge_funkzentrale_hq3_game_ready.glb` (SHA-256 `54e06ad8eb860fe3049bdda4fece257f34227b4344e43e530870abf9c1e30551`). No original GLB was modified or re-exported. No new third-party assets or services are involved.

Regenerate with `npm run assets:building-reference`. Exact image hashes, byte lengths and material references are in `docs/building-design-system/asset-audit.json`; decoded colour/patch measurements are in `texture-audit.json` beside it. The existing source asset provenance and rights continue to apply.

The runtime shares each extracted texture once across the building family. Model-local projection replaces incompatible UV layouts while retaining source geometry, UV attributes and ambient occlusion. HQ3 itself continues to use its original embedded UV maps.
