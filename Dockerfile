FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json index.html animation-lab.html model-preview.html model-3d.html webgl-preview.html ./
COPY src ./src
COPY legacy ./legacy
COPY scripts/build.mjs ./scripts/build.mjs
COPY scripts/animation/model-viewer.js ./scripts/animation/model-viewer.js
COPY scripts/webgl-preview.js ./scripts/webgl-preview.js
COPY scripts/webgl-title-menu.js ./scripts/webgl-title-menu.js
COPY scripts/webgl-battlefield.js ./scripts/webgl-battlefield.js
COPY scripts/webgl-actor-presentation.js ./scripts/webgl-actor-presentation.js
COPY scripts/webgl-environment.js ./scripts/webgl-environment.js
COPY scripts/webgl-combat-vfx.js ./scripts/webgl-combat-vfx.js
COPY scripts/webgl-classic-hud.js ./scripts/webgl-classic-hud.js
COPY scripts/webgl-portraits.js ./scripts/webgl-portraits.js
COPY scripts/webgl-perimeter.js ./scripts/webgl-perimeter.js
COPY scripts/webgl-edge-cliffs.js ./scripts/webgl-edge-cliffs.js
COPY scripts/webgl-grounding.js ./scripts/webgl-grounding.js
COPY scripts/webgl-construction.js ./scripts/webgl-construction.js
COPY scripts/webgl-construction-recovery.js ./scripts/webgl-construction-recovery.js
COPY scripts/webgl-scale.js ./scripts/webgl-scale.js
COPY scripts/webgl-health.js ./scripts/webgl-health.js
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
EXPOSE 8095
ENV PORT=8095
ENV HOST=0.0.0.0
CMD ["node", "scripts/serve.mjs"]
