# syntax=docker/dockerfile:1

#
# Grafana agent downloader
#
FROM --platform=$BUILDPLATFORM docker.io/debian:bullseye AS grafana-agent
ARG TARGETOS
ARG TARGETARCH

RUN apt-get update && apt-get install -y curl unzip
ARG GRAFANA_FILE_NAME="grafana-agent-${TARGETOS}-${TARGETARCH}"
RUN curl -O -L "https://github.com/grafana/agent/releases/latest/download/${GRAFANA_FILE_NAME}.zip" \
    && unzip "${GRAFANA_FILE_NAME}.zip" \
    && chmod a+x ${GRAFANA_FILE_NAME} \
    && mv ${GRAFANA_FILE_NAME} /usr/bin/grafana-agent

#
# Python runtime environment
#
FROM --platform=$BUILDPLATFORM docker.io/python:3.12.0-bullseye
LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0

RUN pip install "poetry==1.4.2"

WORKDIR /app/server

ADD poetry.lock .
ADD pyproject.toml .

RUN poetry config virtualenvs.in-project true && \
    poetry install --without test,docs --no-root

ADD polar polar
ADD scripts scripts
ADD run_worker.py .

ADD bin bin

ADD migrations migrations
ADD alembic.ini .


COPY --from=grafana-agent /usr/bin/grafana-agent /usr/bin/grafana-agent

CMD ["poetry", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000"]
