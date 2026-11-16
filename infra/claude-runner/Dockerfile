# Image for Claude Code self-hosted runners on ECS Fargate.
#
# One image serves two roles, picked by the first argument to the entrypoint:
#   orchestrator  long-lived ECS service; holds the environment secret and starts one
#                 Fargate task per queued session through hooks/spawn-runner
#   runner        one Fargate task per session; joins the tailnet with a single-use key,
#                 serves exactly one session (--capacity 1), then exits so the task is
#                 destroyed
#
# Postgres, Redis and MinIO are sidecar containers in the session task, not part of this
# image: Fargate cannot run a Docker daemon.

FROM ghcr.io/astral-sh/uv:0.13.4 AS uv
FROM node:24-bookworm-slim AS node
FROM bitnamilegacy/minio-client:2024.5.24 AS mc

FROM debian:bookworm-slim

ARG TARGETARCH
ARG CLAUDE_CODE_VERSION
ARG TAILSCALE_VERSION
ARG AWS_CLI_VERSION=2.27.50

ENV DEBIAN_FRONTEND=noninteractive

# Base tools. Same eMudhra/Comodo root mitigation as infra/tailscale and server/Dockerfile.
RUN apt-get -qq update \
  && apt-get -qq install -y --no-install-recommends \
    build-essential ca-certificates curl git gnupg jq less openssh-client procps \
    python3 socat unzip xz-utils \
  && sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' \
    -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf \
  && update-ca-certificates \
  && install -d /usr/share/postgresql-common/pgdg \
  && curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
    -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc \
  && echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main" \
    > /etc/apt/sources.list.d/pgdg.list \
  && apt-get -qq update \
  && apt-get -qq install -y --no-install-recommends postgresql-client-18 \
  && rm -rf /var/lib/apt/lists/*

# AWS CLI v2: the orchestrator's spawn-runner hook calls `aws ecs run-task`.
RUN arch=$([ "$TARGETARCH" = "arm64" ] && echo aarch64 || echo x86_64) \
  && curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-${arch}-${AWS_CLI_VERSION}.zip" -o /tmp/awscli.zip \
  && unzip -q /tmp/awscli.zip -d /tmp \
  && /tmp/aws/install \
  && rm -rf /tmp/aws /tmp/awscli.zip

# Toolchains the Polar session hook expects: Node 24 (.nvmrc), uv + Python 3.14, mc.
COPY --from=node /usr/local/bin/node /usr/local/bin/node
COPY --from=node /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -s ../lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm \
  && ln -s ../lib/node_modules/npm/bin/npx-cli.js /usr/local/bin/npx \
  && ln -s ../lib/node_modules/corepack/dist/corepack.js /usr/local/bin/corepack
COPY --from=uv /uv /uvx /usr/local/bin/
COPY --from=mc /opt/bitnami/minio-client/bin/mc /usr/local/bin/mc
RUN uv python install 3.14

# Tailscale, run in userspace mode: Fargate grants no NET_ADMIN.
RUN version="${TAILSCALE_VERSION:?Set the TAILSCALE_VERSION build argument}" \
  && curl -fsSL "https://pkgs.tailscale.com/stable/tailscale_${version}_${TARGETARCH}.tgz" -o /tmp/tailscale.tgz \
  && tar xzf /tmp/tailscale.tgz --strip-components=1 -C /usr/local/bin \
    "tailscale_${version}_${TARGETARCH}/tailscale" \
    "tailscale_${version}_${TARGETARCH}/tailscaled" \
  && rm /tmp/tailscale.tgz

# Claude Code, pinned. Anthropic does not publish a runner image.
RUN version="${CLAUDE_CODE_VERSION:?Set the CLAUDE_CODE_VERSION build argument}" \
  && arch=$([ "$TARGETARCH" = "arm64" ] && echo linux-arm64 || echo linux-x64) \
  && curl -fsSL "https://downloads.claude.ai/claude-code-releases/${version}/${arch}/claude" \
    -o /usr/local/bin/claude \
  && chmod 755 /usr/local/bin/claude

RUN git config --system user.name "Claude" \
  && git config --system user.email "noreply@anthropic.com" \
  && git config --system --add safe.directory '*'

COPY --chmod=755 bin/ /usr/local/sbin/
COPY --chmod=755 hooks/ /etc/claude/hooks/
COPY --chmod=644 managed-settings.json /etc/claude-code/managed-settings.json

ENV PATH="/root/.local/bin:${PATH}"
WORKDIR /workspace

ENTRYPOINT ["/usr/local/sbin/claude-runner-entrypoint"]
CMD ["runner"]
