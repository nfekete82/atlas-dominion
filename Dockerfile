FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json index.html animation-lab.html model-preview.html model-3d.html ./
COPY src ./src
COPY legacy ./legacy
COPY scripts/build.mjs ./scripts/build.mjs
COPY scripts/animation/model-viewer.js ./scripts/animation/model-viewer.js
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
EXPOSE 8095
ENV PORT=8095
ENV HOST=0.0.0.0
CMD ["node", "scripts/serve.mjs"]
