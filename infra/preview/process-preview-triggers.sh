#!/usr/bin/env bash
#
# Process preview infra triggers. Runs as root via systemd.
# The deploy user can only create trigger files — this script
# decides what privileged operations to perform.
#
set -euo pipefail

TRIGGER_DIR="/srv/preview-triggers"
PREVIEW_TOOLS_DIR="/srv/preview-tools"

while true; do
    found=false
    for trigger in "$TRIGGER_DIR"/*; do
        [[ -f "$trigger" ]] || continue
        found=true
        filename=$(basename "$trigger")

        case "$filename" in
            pr-*.deploy)
                PR_NUM="${filename#pr-}"
                PR_NUM="${PR_NUM%.deploy}"
                if [[ "$PR_NUM" =~ ^[0-9]+$ ]]; then
                    "$PREVIEW_TOOLS_DIR/regenerate-caddyfile.sh"
                    systemctl reload caddy
                    systemctl enable "polar-preview-backend@${PR_NUM}"
                    systemctl restart "polar-preview-backend@${PR_NUM}"
                fi
                ;;
            pr-*.destroy)
                PR_NUM="${filename#pr-}"
                PR_NUM="${PR_NUM%.destroy}"
                if [[ "$PR_NUM" =~ ^[0-9]+$ ]]; then
                    systemctl stop "polar-preview-backend@${PR_NUM}" 2>/dev/null || true
                    systemctl stop "polar-preview-frontend@${PR_NUM}" 2>/dev/null || true
                    systemctl disable "polar-preview-backend@${PR_NUM}" 2>/dev/null || true
                    systemctl disable "polar-preview-frontend@${PR_NUM}" 2>/dev/null || true
                    "$PREVIEW_TOOLS_DIR/regenerate-caddyfile.sh"
                    systemctl reload caddy 2>/dev/null || true
                fi
                ;;
            pr-*.wake)
                PR_NUM="${filename#pr-}"
                PR_NUM="${PR_NUM%.wake}"
                if [[ "$PR_NUM" =~ ^[0-9]+$ ]]; then
                    if ! systemctl is-active --quiet "polar-preview-backend@${PR_NUM}"; then
                        systemctl start "polar-preview-backend@${PR_NUM}"
                    fi
                fi
                ;;
        esac

        rm -f "$trigger"
    done
    "$found" || break
done
