# syntax=docker/dockerfile:1

# Build context is the REPOSITORY ROOT, so the shared tsconfig is reachable:
#   docker build -f frontend/Dockerfile .

FROM node:22-alpine AS build

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json ./
# --legacy-peer-deps matches the documented local install: the Angular 22
# toolchain declares peer ranges npm cannot satisfy strictly.
RUN npm ci --legacy-peer-deps

COPY tsconfig.base.json /tsconfig.base.json
COPY frontend/ ./

RUN npm run build


FROM nginxinc/nginx-unprivileged:1.27-alpine AS runtime

# The unprivileged image already runs as a non-root user and listens on 8080.

COPY --from=build /app/dist/automail-frontend/browser /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/templates/default.conf.template

# Where this container should forward /api/ to. Overridden per environment.
ENV API_ORIGIN=http://api:3000

# The entrypoint runs envsubst over the template, which by default would also
# replace nginx's own runtime variables ($host, $uri, $remote_addr) with empty
# strings and break the proxy. This filter restricts substitution to API_ORIGIN.
ENV NGINX_ENVSUBST_FILTER="API_ORIGIN"


EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:8080/index.html || exit 1
