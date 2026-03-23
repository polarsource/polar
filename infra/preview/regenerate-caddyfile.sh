#!/usr/bin/env bash
#
# Regenerate the main Caddyfile from per-preview configs.
# Root-owned — deploy user calls this via sudo.
#
# The auth gate on :8080 is defined here, not in PR code, so it cannot
# be bypassed by a malicious PR modifying caddy-preview.template.
#
set -euo pipefail

CADDY_PREVIEWS_DIR="/etc/caddy/previews"

# Shared handle_errors block for hibernated backends
HANDLE_ERRORS=$(cat <<'ERRORS'
	handle_errors {
		@hibernated {
			expression {err.status_code} == 502
			path_regexp pr ^/pr-(\d+)/(v1|backoffice|healthz)
		}
		handle @hibernated {
			rewrite * /wake/pr-{re.pr.1}
			reverse_proxy 127.0.0.1:9999
		}
	}
ERRORS
)

{
    echo ':80 {'
    for f in "$CADDY_PREVIEWS_DIR"/*.caddy; do
        [[ -f "$f" ]] && sed 's/^/\t/' "$f"
    done
    echo "$HANDLE_ERRORS"
    echo '}'
    echo ''
    echo ':8080 {'
    echo '	route {'
    cat <<'AUTH'
		@no_token not header X-Preview-Token {$POLAR_PREVIEW_ACCESS_TOKEN}
		respond @no_token "Forbidden" 403
AUTH
    for f in "$CADDY_PREVIEWS_DIR"/*.caddy; do
        [[ -f "$f" ]] && sed 's/^/\t\t/' "$f"
    done
    echo '	}'
    echo "$HANDLE_ERRORS"
    echo '}'
} > /etc/caddy/Caddyfile
