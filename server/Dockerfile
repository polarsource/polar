FROM node:22-slim AS build-emails-bin

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY ./emails/pnpm-lock.yaml .
COPY ./emails/package.json .
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY ./emails/src src/
COPY ./emails/tsconfig.json .
COPY ./emails/tsup.config.js .

RUN pnpm run build

FROM node:22-slim AS build-backoffice

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY ./polar/backoffice/pnpm-lock.yaml .
COPY ./polar/backoffice/package.json .
COPY ./polar/backoffice/pnpm-workspace.yaml .
RUN --mount=type=cache,target=/pnpm/store \
  pnpm install --frozen-lockfile --store-dir=/pnpm/store

COPY ./polar/backoffice/ .

RUN pnpm run build

FROM alpine:3.21 AS download-ipinfo

RUN apk add --no-cache curl jq

RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN \
  mkdir /data && \
  TOKEN=$(cat /run/secrets/IPINFO_ACCESS_TOKEN) && \
  EXPECTED_SHA256=$(curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb/checksums?token=${TOKEN}" | jq -r '.checksums.sha256') && \
  curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb?token=${TOKEN}" -o /data/country_asn.mmdb && \
  echo "${EXPECTED_SHA256}  /data/country_asn.mmdb" | sha256sum -c -

FROM alpine:3.21 AS download-cjk-fonts

RUN apk add --no-cache curl

COPY --chmod=755 docker/download_cjk_fonts.sh /usr/local/bin/download-cjk-fonts
RUN download-cjk-fonts

FROM caddy:2.11.4-builder AS build-backoffice-proxy
RUN xcaddy build v2.11.4 --with github.com/caddy-dns/cloudflare@v0.2.4

FROM --platform=$BUILDPLATFORM python:3.14.6-slim AS production
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0
COPY --from=ghcr.io/astral-sh/uv:0.11.24 /uv /uvx /bin/
COPY --from=docker.io/tailscale/tailscale:v1.98.4 /usr/local/bin/tailscaled /usr/local/bin/tailscale /usr/local/bin/containerboot /usr/local/bin/
COPY --from=build-backoffice-proxy /usr/bin/caddy /usr/local/bin/caddy

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_NO_SYNC=1
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  --mount=type=cache,target=/root/.cache/uv \
  apt-get update \
  && apt-get install -y \
  curl \
  git \
  build-essential \
  libpq5 \
  && uv sync --no-group dev --frozen \
  && uv tool install tinybird --python 3.13 \
  && apt-get autoremove -y build-essential

ADD . /app/server/

COPY --from=build-emails-bin /app/bin/react-email-pkg /app/server/
ENV POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg

COPY --from=build-backoffice /app/static /app/server/polar/backoffice/static

COPY --from=download-ipinfo /data /data
ENV POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data
ENV POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

COPY --from=download-cjk-fonts /fonts/ /app/server/polar/invoice/fonts/

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

CMD ["uv", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000", "--limit-max-requests", "50000", "--limit-max-requests-jitter", "10000", "--timeout-graceful-shutdown", "30"]

FROM public.ecr.aws/lambda/python:3.14 AS lambda-build
COPY --from=ghcr.io/astral-sh/uv:0.11.24 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_NO_SYNC=1

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  --mount=type=cache,target=/root/.cache/uv \
  dnf install -y gcc gcc-c++ git make \
  && uv sync --no-group dev --frozen \
  && dnf clean all

ADD . /app/server/

COPY --from=build-emails-bin /app/bin/react-email-pkg /app/server/
ENV POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg

COPY --from=build-backoffice /app/static /app/server/polar/backoffice/static
COPY --from=download-ipinfo /data /data
COPY --from=download-cjk-fonts /fonts/ /app/server/polar/invoice/fonts/

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

FROM public.ecr.aws/lambda/python:3.14 AS lambda

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

COPY --from=lambda-build /app /app
COPY --from=lambda-build /data /data
COPY --from=docker.io/tailscale/tailscale:v1.98.4 /usr/local/bin/tailscaled /var/runtime/tailscaled
COPY --from=docker.io/tailscale/tailscale:v1.98.4 /usr/local/bin/tailscale /var/runtime/tailscale

ENV LAMBDA_TASK_ROOT=/app/server
ENV PATH="/app/server/.venv/bin:$PATH"
ENV PYTHONPATH="/app/server:/app/server/.venv/lib/python3.14/site-packages"
ENV POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg
ENV POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data
ENV POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

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
