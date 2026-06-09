# Stage 5: Final production image
FROM --platform=$BUILDPLATFORM python:3.14-slim AS production
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar Sidecar"
LABEL org.opencontainers.image.licenses=Apache-2.0
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_NO_CACHE=1
ENV UV_NO_SYNC=1
ENV PATH="/root/.local/bin:$PATH"

WORKDIR /app/sidecar

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
  --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
  apt-get update \
  && apt-get install -y \
  git \
  build-essential \
  libpq-dev \
  && uv sync --no-group dev --frozen \
  && uv tool install tinybird --python 3.13 \
  && apt-get autoremove -y build-essential

ADD . /app/sidecar/

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

CMD ["uv", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000", "--limit-max-requests", "50000", "--limit-max-requests-jitter", "10000", "--timeout-graceful-shutdown", "30"]
