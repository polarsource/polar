#!/bin/sh
set -eu

DUMP=/pg15-dump/pg15.sql
[ -f "$DUMP" ] || exit 0

echo "Restoring Postgres 15 data from $DUMP"
if ! psql -U "$POSTGRES_USER" -d postgres -f "$DUMP" > /dev/null 2> /tmp/pg15-restore.err; then
  cat /tmp/pg15-restore.err >&2
  exit 1
fi
if grep ERROR /tmp/pg15-restore.err | grep -v 'already exists'; then
  exit 1
fi
rm "$DUMP"
