FROM --platform=$BUILDPLATFORM python:3.12-slim
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV PYTHONUNBUFFERED=1
ENV UV_COMPILE_BYTECODE=1
ENV UV_NO_CACHE=1

WORKDIR /app/server

RUN --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    apt-get update && apt-get install -y build-essential redis libpq-dev curl \
    && uv sync --no-group dev --no-group backoffice --frozen \
    && apt-get autoremove -y build-essential

ADD . /app/server/

RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN mkdir /data && curl -fsSL https://ipinfo.io/data/free/country_asn.mmdb?token=$(cat /run/secrets/IPINFO_ACCESS_TOKEN) -o /data/country_asn.mmdb
ENV POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data
ENV POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

CMD ["uv", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000"]
