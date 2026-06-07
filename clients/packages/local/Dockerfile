# syntax=docker/dockerfile:1
#
# @polar-sh/local — sidecar image.
#
# This package lives in the clients/ pnpm workspace and depends on the
# @polar-sh/client workspace package, so the build context must be the workspace
# root (clients/), not this directory.
#
#   cd clients
#   docker build -f packages/local/Dockerfile -t polar-local .
#
# or, from this package:  pnpm docker:build
#
# Run it (all config is via env — see README.md):
#
#   docker run --rm -p 8787:8787 -v polar-local-data:/data \
#     -e POLAR_ACCESS_TOKEN=polar_... -e LOCAL_DB_PATH=/data/local.db \
#     polar-local
#
# Mount your billing-as-code module and point LOCAL_BILLING at it:
#
#   ... -v "$PWD/billing.ts:/billing/billing.ts" -e LOCAL_BILLING=/billing/billing.ts

FROM node:24-slim AS runtime
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable
WORKDIR /repo

# The whole workspace (node_modules/dist are excluded via Dockerfile.dockerignore).
COPY . .

# Install only the sidecar and its workspace dependencies. The --filter scope
# keeps the heavy app packages (web, orbit, …) out of the install and skips the
# workspace's turbo `prepare`. Then build the one workspace dep the sidecar needs
# at runtime: @polar-sh/client emits dist/ that `tsx` imports.
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile --filter @polar-sh/local... \
 && pnpm --filter @polar-sh/client run build

WORKDIR /repo/packages/local

# The durable SQLite log lives on a volume so events survive container restarts —
# losing it would mean re-forwarding from an empty outbox. The store is the
# commit point; this volume is what makes "keeps working when Polar is down" real.
ENV LOCAL_DB_PATH=/data/local.db
VOLUME /data
EXPOSE 8787

# Liveness: /health is cheap and reports delivery lag. Uses Node's built-in fetch.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD node -e "fetch('http://localhost:'+(process.env.LOCAL_PORT||8787)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# tsx runs the TypeScript source directly — no build step for the sidecar itself.
CMD ["pnpm", "start"]
