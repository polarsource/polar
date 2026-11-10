#!/bin/sh
set -eu

DATA=/var/lib/postgresql/data
[ -s "$DATA/PG_VERSION" ] || exit 0
[ -e /dump/done ] && exit 0

gosu postgres pg_ctl -D "$DATA" -o "-c listen_addresses=''" -w start
gosu postgres pg_dumpall -U "$POSTGRES_USER" > /dump/pg15.sql.tmp
gosu postgres pg_ctl -D "$DATA" -m fast -w stop

mv /dump/pg15.sql.tmp /dump/pg15.sql
touch /dump/done
chown -R postgres:postgres /dump
