# Approved game integration · 2026-11-13

The owner approved the reference pack and requested integration into the game.
The three references are the normal default visuals in the real WebGL game:
`rover`, `barracks` and `infantry`, for both owners. No gallery-only switch or
special gameplay option is needed.

The full game is running locally at **http://127.0.0.1:8106/** using
`sandforge-rc2-preview-sandforge-rc2-preview-1`. Its image is
`sha256:eb4763ab963babb74b0d98eef1e1e2e1b88b182cdc9aa0c14ad3a53bb80e749a`.
The existing port 8095 container was inspected and contains an older Canvas
entry point and older WebGL modules. The approved 3D build therefore uses
the repository's separate existing Compose service on 8106.

The Docker build now copies both `building-gallery.html` and `art-gallery.html`;
the normal distribution build reads these files and previously could not
complete inside Docker with its explicit HTML COPY list.

Executed on the integrated build:

- Docker multi-stage build: passed, including clean `npm ci` and WebGL build.
- Compose startup and health check: healthy; HTTP `/healthz` returns 200.
- Reference GLB/rig/clearance tests: 11 passed.
- Existing release/root-entry tests: 5 passed.
- Full reference browser verification against port 8106: passed, including
  real entity rendering, progressive construction, all four production exit
  rotations, wheel start/stop, team capture repaint, Death playback and legacy
  fallback. No page/shader errors were captured. See
  [structured results](qa/docker-integration-results.json).

Rebuild and start this same local game with:

```sh
docker compose -p sandforge-rc2-preview -f compose.rc2-preview.yaml up --build -d
```

This integrates the approved three references into the existing 3D game branch.
It does not complete the rest of the roster/environment art migration, merge
the historical 3D branch stack into `main`, or publish an Uberspace release.
