FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json index.html animation-lab.html model-preview.html model-3d.html webgl-preview.html ./
COPY src ./src
COPY legacy ./legacy
# Copy every runtime WebGL module; selective copies omitted dynamic imports.
COPY scripts ./scripts
RUN npm ci --no-audit --no-fund && SANDFORGE_RENDERER=webgl npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
EXPOSE 8095
ENV PORT=8095
ENV HOST=0.0.0.0
CMD ["node", "scripts/serve.mjs"]
