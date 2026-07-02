#!/bin/sh
set -e

: "${DB_HOST:?DB_HOST is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"

cat > /etc/pgbouncer/userlist.txt <<EOF
"${DB_USER}" "${DB_PASSWORD}"
EOF
chmod 600 /etc/pgbouncer/userlist.txt

cat > /etc/pgbouncer/pgbouncer.ini <<EOF
[databases]
* = host=${DB_HOST} port=${DB_PORT:-5432}

[pgbouncer]
listen_addr = 0.0.0.0
listen_port = ${LISTEN_PORT:-5432}
unix_socket_dir =
auth_type = ${AUTH_TYPE:-scram-sha-256}
auth_file = /etc/pgbouncer/userlist.txt
admin_users = ${ADMIN_USERS:-${DB_USER}}
stats_users = ${STATS_USERS:-${DB_USER}}
pool_mode = ${POOL_MODE:-transaction}
max_client_conn = ${MAX_CLIENT_CONN:-1000}
default_pool_size = ${DEFAULT_POOL_SIZE:-20}
min_pool_size = ${MIN_POOL_SIZE:-0}
reserve_pool_size = ${RESERVE_POOL_SIZE:-0}
reserve_pool_timeout = ${RESERVE_POOL_TIMEOUT:-5}
max_prepared_statements = ${MAX_PREPARED_STATEMENTS:-200}
server_tls_sslmode = ${SERVER_TLS_SSLMODE:-prefer}
ignore_startup_parameters = ${IGNORE_STARTUP_PARAMETERS:-extra_float_digits}
EOF

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
