# Shared tooling for the Render and Lambda builds.
FROM ghcr.io/astral-sh/uv:0.11.24 AS uv
FROM tailscale/tailscale:v1.98.4 AS tailscale

# Build the email renderer and backoffice assets with the same Node/pnpm setup.
FROM node:22-slim AS node-builder

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

FROM node-builder AS build-emails-bin

COPY emails/pnpm-lock.yaml emails/package.json ./
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY emails/src src/
COPY emails/tsconfig.json emails/tsup.config.js ./
RUN pnpm run build

FROM node-builder AS build-backoffice

COPY polar/backoffice/pnpm-lock.yaml polar/backoffice/package.json polar/backoffice/pnpm-workspace.yaml ./
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY polar/backoffice/ .
RUN pnpm run build

# Deployment builds refresh IPInfo; font URLs and checksums are version-pinned.
FROM alpine:3.21 AS download-ipinfo

RUN apk add --no-cache curl jq

COPY --chmod=755 docker/download_ipinfo.sh /usr/local/bin/download-ipinfo
RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN download-ipinfo

FROM alpine:3.21 AS download-cjk-fonts

RUN apk add --no-cache curl

COPY --chmod=755 docker/download_cjk_fonts.sh /usr/local/bin/download-cjk-fonts
RUN download-cjk-fonts

# Caddy needs the Cloudflare module to issue certificates through DNS challenges.
FROM caddy:2.11.4-builder AS build-backoffice-proxy
RUN xcaddy build v2.11.4 --with github.com/caddy-dns/cloudflare@v0.2.4

# Assemble the shared application files independently of either Python runtime.
FROM scratch AS application

COPY . /app/server/
COPY --from=build-emails-bin /app/bin/react-email-pkg /app/server/
COPY --from=build-backoffice /app/static /app/server/polar/backoffice/static
COPY --from=download-ipinfo /data /data
COPY --from=download-cjk-fonts /fonts/ /app/server/polar/invoice/fonts/

# Render backend image, also used by the private backoffice.
FROM --platform=$BUILDPLATFORM python:3.14.6-slim AS production

LABEL org.opencontainers.image.source=https://github.com/polarsource/polar \
  org.opencontainers.image.description="Polar" \
  org.opencontainers.image.licenses=Apache-2.0

COPY --from=uv /uv /uvx /bin/
COPY --from=tailscale /usr/local/bin/tailscaled /usr/local/bin/tailscale /usr/local/bin/containerboot /usr/local/bin/
COPY --from=build-backoffice-proxy /usr/bin/caddy /usr/local/bin/caddy

ENV PYTHONUNBUFFERED=1 \
  UV_COMPILE_BYTECODE=1 \
  UV_LINK_MODE=copy \
  UV_NO_SYNC=1 \
  PATH="/root/.local/bin:$PATH"

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  --mount=type=cache,target=/root/.cache/uv \
  apt-get update \
  && apt-get install -y build-essential curl git libpq5 \
  && uv sync --no-group dev --frozen \
  && uv tool install tinybird --python 3.13 \
  && apt-get autoremove -y build-essential

COPY --from=application /app /app
COPY --from=application /data /data

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION} \
  POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg \
  POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data \
  POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

CMD ["uv", "run", "uvicorn", "polar.app:app", \
  "--host", "0.0.0.0", "--port", "10000", \
  "--limit-max-requests", "50000", "--limit-max-requests-jitter", "10000", \
  "--timeout-graceful-shutdown", "30"]

# Compile dependencies on Amazon Linux to match the Lambda runtime.
FROM public.ecr.aws/lambda/python:3.14 AS lambda-build

COPY --from=uv /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1 \
  UV_COMPILE_BYTECODE=1 \
  UV_LINK_MODE=copy \
  UV_NO_SYNC=1

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  --mount=type=cache,target=/root/.cache/uv \
  dnf install -y gcc gcc-c++ git make \
  && uv sync --no-group dev --frozen \
  && dnf clean all

COPY --from=application /app /app
COPY --from=application /data /data

# Lambda worker image, with dependencies but without the build toolchain.
FROM public.ecr.aws/lambda/python:3.14 AS lambda

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION} \
  LAMBDA_TASK_ROOT=/app/server \
  PATH="/app/server/.venv/bin:$PATH" \
  PYTHONPATH="/app/server:/app/server/.venv/lib/python3.14/site-packages" \
  POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg \
  POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data \
  POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

COPY --from=lambda-build /app /app
COPY --from=lambda-build /data /data
COPY --from=tailscale /usr/local/bin/tailscaled /usr/local/bin/tailscale /var/runtime/

WORKDIR /app/server

RUN mkdir -p /var/run /var/cache /var/lib /var/task \
  && rm -rf /var/run/tailscale /var/cache/tailscale /var/lib/tailscale /var/task/tailscale \
  && ln -s /tmp/tailscale /var/run/tailscale \
  && ln -s /tmp/tailscale /var/cache/tailscale \
  && ln -s /tmp/tailscale /var/lib/tailscale \
  && ln -s /tmp/tailscale /var/task/tailscale

COPY docker/export_lambda_secrets.py /var/runtime/export-secrets.py
COPY --chmod=755 docker/run_lambda_worker.sh /var/runtime/polar-bootstrap

ENTRYPOINT ["/var/runtime/polar-bootstrap"]
CMD ["polar.worker.aws_lambda.handler"]
