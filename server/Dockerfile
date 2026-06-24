# Stage 1: Build the email renderer binary
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

# Stage 2: Build the backoffice static assets
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

# Stage 3: Download IPInfo database with checksum validation
FROM alpine:3.21 AS download-ipinfo

RUN apk add --no-cache curl jq

RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN \
  mkdir /data && \
  TOKEN=$(cat /run/secrets/IPINFO_ACCESS_TOKEN) && \
  EXPECTED_SHA256=$(curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb/checksums?token=${TOKEN}" | jq -r '.checksums.sha256') && \
  curl -fsSL "https://ipinfo.io/data/free/country_asn.mmdb?token=${TOKEN}" -o /data/country_asn.mmdb && \
  echo "${EXPECTED_SHA256}  /data/country_asn.mmdb" | sha256sum -c -

# Stage 4: Download per-script Noto Sans CJK .ttf fonts with checksum validation.
# URLs are pinned to versioned (v39/v40/v56) gstatic.com paths returned by
# https://fonts.googleapis.com/css2; those paths are immutable for a given
# version. We use TrueType (glyf) builds because PDF.js (Firefox) does not
# render glyphs from the CFF/OTF subsets that ship in fonts-noto-cjk.
FROM alpine:3.21 AS download-cjk-fonts

RUN apk add --no-cache curl

RUN <<EOF
set -eu
mkdir /fonts
cd /fonts
curl -fsSLo NotoSansTC-Regular.ttf 'https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz76Cy_Co.ttf'
curl -fsSLo NotoSansTC-Bold.ttf    'https://fonts.gstatic.com/s/notosanstc/v39/-nFuOG829Oofr2wohFbTp9ifNAn722rq0MXz70e1_Co.ttf'
curl -fsSLo NotoSansSC-Regular.ttf 'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaG9_FnYw.ttf'
curl -fsSLo NotoSansSC-Bold.ttf    'https://fonts.gstatic.com/s/notosanssc/v40/k3kCo84MPvpLmixcA63oeAL7Iqp5IZJF9bmaGzjCnYw.ttf'
curl -fsSLo NotoSansJP-Regular.ttf 'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFBEj75s.ttf'
curl -fsSLo NotoSansJP-Bold.ttf    'https://fonts.gstatic.com/s/notosansjp/v56/-F6jfjtqLzI2JPCgQBnw7HFyzSD-AsregP8VFPYk75s.ttf'
curl -fsSLo NotoSansKR-Regular.ttf 'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzuoyeLQ.ttf'
curl -fsSLo NotoSansKR-Bold.ttf    'https://fonts.gstatic.com/s/notosanskr/v39/PbyxFmXiEBPT4ITbgNA5Cgms3VYcOA-vvnIzzg01eLQ.ttf'
sha256sum -c <<CHECKSUMS
619662a0583f38311e92666927e5edbfd30f2a1fbe8593685660bd11bdd46a10  NotoSansTC-Regular.ttf
33e8464f3432fd9eba5fa6ff74f5fb9ee612cad703877bd71c36e6f167c0a7e3  NotoSansTC-Bold.ttf
450625c8d46ab3df97b7904ded955ec2746d17ec76740cb1e91d1ba63a0f89af  NotoSansSC-Regular.ttf
0066a522a1ac007c1d72bc4fccb114f80ff7294641c78cead9715bd14d43b9ea  NotoSansSC-Bold.ttf
4593dfcdc70ee68852606c90d75dfc6e022feda12780a55615239c53c54ef086  NotoSansJP-Regular.ttf
a3910e15eea0451ffbea62e894e951ea9f7c812c8b4b5e947593b6ecc2d4b057  NotoSansJP-Bold.ttf
c733940a7dc687142848b30a491e97138ed58dc58c4cae33c44e3ee52da411cb  NotoSansKR-Regular.ttf
5ebb0def0fe9e7c853253eca8ec9c1066adc479f2e248533b412ed0c6a663abc  NotoSansKR-Bold.ttf
CHECKSUMS
EOF

# Stage 5: Final production image
FROM --platform=$BUILDPLATFORM python:3.14-slim AS production
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0
COPY --from=ghcr.io/astral-sh/uv:0.11.24 /uv /uvx /bin/

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

# Stage 6: AWS Lambda image (SQS-driven background tasks, POC)
FROM public.ecr.aws/lambda/python:3.14 AS lambda-build
COPY --from=ghcr.io/astral-sh/uv:0.11.24 /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_LINK_MODE=copy
ENV UV_NO_CACHE=1
ENV UV_NO_SYNC=1

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
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
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscaled /var/runtime/tailscaled
COPY --from=docker.io/tailscale/tailscale:stable /usr/local/bin/tailscale /var/runtime/tailscale

ENV LAMBDA_TASK_ROOT=/app/server
ENV PATH="/app/server/.venv/bin:$PATH"
ENV PYTHONPATH="/app/server/.venv/lib/python3.14/site-packages:/app/server"
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

RUN <<'EOF'
cat > /var/runtime/polar-bootstrap <<'BOOTSTRAP'
#!/bin/sh
set -eu

if [ -n "${POLAR_JWKS_CONTENT:-}" ] && [ -n "${POLAR_JWKS:-}" ]; then
  mkdir -p "$(dirname "$POLAR_JWKS")"
  printf "%s" "$POLAR_JWKS_CONTENT" > "$POLAR_JWKS"
fi

# Tailscale disabled: ALL_PROXY routed HTTP egress through the SOCKS proxy. Re-enable for private-network access.
# if [ -n "${TAILSCALE_AUTHKEY:-}" ]; then
#   mkdir -p /tmp/tailscale
#   /var/runtime/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
#   tailscale_hostname="${TAILSCALE_HOSTNAME:-polar-${POLAR_ENV:-unknown}-worker-lambda}"
#   tailscale_tags="tag:${POLAR_ENV:-unknown},tag:worker-lambda,tag:aws"
#   until /var/runtime/tailscale up --authkey="${TAILSCALE_AUTHKEY}?ephemeral=true&preauthorized=true" --hostname="${tailscale_hostname}" --advertise-tags="${tailscale_tags}"; do
#     sleep 0.1
#   done
#   export ALL_PROXY="${ALL_PROXY:-socks5://localhost:1055/}"
# fi

exec /lambda-entrypoint.sh "$@"
BOOTSTRAP
chmod +x /var/runtime/polar-bootstrap
EOF

ENTRYPOINT ["/var/runtime/polar-bootstrap"]
CMD ["polar.worker.aws_lambda.handler"]
