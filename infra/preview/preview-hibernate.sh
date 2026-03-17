#!/usr/bin/env bash
#
# Hibernate idle preview backends.
# Stops services with no recent uvicorn request logs in journald.
# Runs periodically via systemd timer.
#
set -euo pipefail

IDLE_TIMEOUT="${POLAR_PREVIEW_IDLE_TIMEOUT:-1800}" # 30 minutes

for unit in $(systemctl list-units --type=service --state=running --plain --no-legend 'polar-preview-backend@*' | awk '{print $1}'); do
    PR_NUM="${unit#polar-preview-backend@}"
    PR_NUM="${PR_NUM%.service}"
    [[ "$PR_NUM" =~ ^[0-9]+$ ]] || continue

    if journalctl -u "$unit" --since "-${IDLE_TIMEOUT}s" --no-pager -q -n 1 2>/dev/null | grep -q .; then
        continue
    fi

    echo "[hibernate] Stopping idle preview pr-${PR_NUM} (no activity in ${IDLE_TIMEOUT}s)"
    systemctl stop "$unit"
done
