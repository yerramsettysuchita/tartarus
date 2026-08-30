# Tartarus public, view-only deployment.
# Builds the backend and the dashboard, then serves them with the secret-free
# static server (src/server/serve.ts). No keys, no hunts run here.
FROM node:22-slim AS build
WORKDIR /app

# Backend deps + build
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# UI deps + build
COPY ui/package.json ui/package-lock.json ./ui/
RUN cd ui && npm ci
COPY ui ./ui
RUN cd ui && npm run build

# ---- runtime ----
FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Only what the view-only server needs: compiled backend, its node_modules, and ui/dist.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/ui/dist ./ui/dist
COPY package.json ./

EXPOSE 8080
CMD ["node", "dist/server/serve.js"]
