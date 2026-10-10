# syntax=docker/dockerfile:1
# One image for both processes: `docker run <image> api` or `docker run <image> worker`.

ARG NODE_IMAGE=node:24.21.0-alpine3.24

# --- base: Node + pnpm (version from package.json "packageManager") ---------------
FROM ${NODE_IMAGE} AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    COREPACK_ENABLE_DOWNLOAD_PROMPT=0 \
    HUSKY=0
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./

# --- build: all dependencies, compile TypeScript ---------------------------------
FROM base AS build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store pnpm install --frozen-lockfile
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN pnpm build

# --- prod-deps: production dependencies only -------------------------------------
FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --prod --ignore-scripts

# --- runtime: small image, non-root user ------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --chown=node:node package.json ./
COPY --chown=node:node contract/package.json ./contract/package.json
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node docker/entrypoint.sh /usr/local/bin/entrypoint.sh

ARG APP_VERSION=0.0.0
ARG APP_COMMIT=unknown
ENV APP_VERSION=${APP_VERSION} \
    APP_COMMIT=${APP_COMMIT}

USER node
# API, worker probes, API metrics, worker metrics.
EXPOSE 3000 3001 9464 9465
# Node runs as PID 1 and handles SIGTERM/SIGINT itself (graceful shutdown). It starts no
# child processes, so no init is needed; `docker run --init` / compose `init: true` add one anyway.
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["api"]
