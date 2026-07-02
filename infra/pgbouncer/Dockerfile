FROM debian:trixie-slim

RUN apt-get -qq update \
  && apt-get -qq install -y --no-install-recommends \
    ca-certificates \
    postgresql-common \
  > /dev/null \
  && /usr/share/postgresql-common/pgdg/apt.postgresql.org.sh -y \
  && apt-get -qq install -y --no-install-recommends pgbouncer > /dev/null \
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
