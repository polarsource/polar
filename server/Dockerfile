FROM --platform=$BUILDPLATFORM python:3.12-slim
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0

ENV PYTHONUNBUFFERED=1

WORKDIR /app/server

ADD uv.lock .
ADD pyproject.toml .

RUN apt-get update && apt-get install -y build-essential redis libpq-dev curl \
    && pip install --upgrade pip uv \
    && uv sync --no-group dev --no-group backoffice --frozen \
    && apt-get autoremove -y build-essential

ADD polar polar
ADD scripts scripts
ADD run_worker.py .

ADD migrations migrations
ADD alembic.ini .

RUN --mount=type=secret,id=IPINFO_ACCESS_TOKEN mkdir /data && curl -fsSL https://ipinfo.io/data/free/country_asn.mmdb?token=$(cat /run/secrets/IPINFO_ACCESS_TOKEN) -o /data/country_asn.mmdb
ENV POLAR_IP_GEOLOCATION_DATABASE_DIRECTORY_PATH=/data
ENV POLAR_IP_GEOLOCATION_DATABASE_NAME=country_asn.mmdb

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION}

CMD ["uv", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000"]
