FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json tsconfig.json index.html ./
COPY src ./src
COPY scripts/build.mjs ./scripts/build.mjs
RUN npm install --no-audit --no-fund && npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY scripts/serve.mjs ./scripts/serve.mjs
EXPOSE 8080
ENV PORT=8080
CMD ["node", "scripts/serve.mjs"]
