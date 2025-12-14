FROM node:22-slim AS build-emails-bin

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

COPY ./emails/pnpm-lock.yaml .
COPY ./emails/package.json .
RUN pnpm install --frozen-lockfile

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
RUN pnpm install --frozen-lockfile

COPY ./polar/backoffice/ .

RUN pnpm run build

FROM --platform=$BUILDPLATFORM python:3.14-slim
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_NO_CACHE=1
ENV UV_NO_SYNC=1

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  apt-get update \
  && apt-get install -y \
  git \
  build-essential \
  redis \
  libpq-dev \
  curl \
  # tzdata-legacy is needed to accept legacy timezone names in Python like "Asia/Calcutta"
  tzdata-legacy \
  && uv sync --no-group dev --frozen \
  && apt-get autoremove -y build-essential

ADD . /app/server/

COPY --from=build-emails-bin /app/bin/react-email-pkg /app/server/
ENV POLAR_EMAIL_RENDERER_BINARY_PATH=/app/server/react-email-pkg

COPY --from=build-backoffice /app/static /app/server/polar/backoffice/static
RUN ls -la /app/server/polar/backoffice/static

RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN mkdir /data && curl -fsSL https://ipinfo.io/data/free/country_asn.mmdb?token=$(cat /run/secrets/IPINFO_ACCESS_TOKEN) -o /data/country_asn.mmdb
ENV POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data
ENV POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

CMD ["uv", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000"]
