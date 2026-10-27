# Dockerfile inspired by https://github.com/edoburu/docker-pgbouncer

FROM debian:trixie-slim
ARG PGBOUNCER_APT_VERSION=1.25.2-1.pgdg13+1
RUN apt-get -qq update \
  && apt-get -qq install -y --no-install-recommends \
    ca-certificates \
    postgresql-common \
  > /dev/null \
  && sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' \
    -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf \
  && update-ca-certificates \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt-get -qq install -y --no-install-recommends pgbouncer="${PGBOUNCER_APT_VERSION}" > /dev/null \
  && apt-get -qq clean \
  && rm -rf \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

COPY --chmod=755 entrypoint.sh /usr/local/bin/pgbouncer-entrypoint

RUN chown -R postgres:postgres /etc/pgbouncer

USER postgres
EXPOSE 5432

CMD ["/usr/local/bin/pgbouncer-entrypoint"]
