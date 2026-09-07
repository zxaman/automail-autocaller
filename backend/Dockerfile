# syntax=docker/dockerfile:1

# Multi-stage so the runtime image carries no compiler, no dev dependencies and
# no TypeScript source. Smaller image, smaller attack surface.
#
# Build context is the REPOSITORY ROOT, not backend/, because backend/tsconfig.json
# extends ../tsconfig.base.json and Docker cannot copy above its context:
#   docker build -f backend/Dockerfile .

FROM node:22-alpine AS build

WORKDIR /app

# Copy manifests first so a source-only change reuses the cached install layer.
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# The shared compiler options live one level up, mirroring the repo layout so
# the relative "extends" path resolves inside the image exactly as it does locally.
COPY tsconfig.base.json /tsconfig.base.json
COPY backend/tsconfig.json ./
COPY backend/src ./src

RUN npm run build


FROM node:22-alpine AS runtime

# dumb-init gives PID 1 correct signal handling, so SIGTERM reaches Node and
# the graceful shutdown path actually runs instead of the container being killed.
RUN apk add --no-cache dumb-init

ENV NODE_ENV=production
WORKDIR /app

COPY backend/package.json backend/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Attachments are written here when the local storage driver is used. Owned by
# the app user so the container does not need to run as root to write them.
RUN mkdir -p /app/storage/attachments && chown -R node:node /app

# Never run the application as root.
USER node

EXPOSE 3000

# Hits the readiness endpoint, so an unhealthy database marks the container
# unhealthy rather than leaving it in rotation serving errors.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/v1/health/ready').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
