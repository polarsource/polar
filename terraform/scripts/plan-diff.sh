#!/usr/bin/env bash
#
# Print the per-attribute before -> after for every changed resource in a TFC
# plan, unmasking values the TFC UI shows as "(sensitive value)".
#
# Usage:
#   ./plan-diff.sh [-w|--whitespace] run-XXXXXXXX [FILTER]
#   -w:     reveal whitespace in values (·=space →=tab ␊=newline ␍=CR)
#   FILTER: optional substring matched against the resource address or type
#           e.g. ./plan-diff.sh run-XXXX render_web_service
#
# Token: read from $TFE_TOKEN, else from ~/.terraform.d/credentials.tfrc.json
# Host:  override with $TFE_HOST (default app.terraform.io)

set -euo pipefail

WS=0
if [[ "${1:-}" == "-w" || "${1:-}" == "--whitespace" ]]; then
  WS=1
  shift
fi

RUN_ID="${1:-}"
FILTER="${2:-}"
TFE_HOST="${TFE_HOST:-app.terraform.io}"

if [[ -z "$RUN_ID" ]]; then
  echo "usage: $0 [-w|--whitespace] run-XXXXXXXX [FILTER]   (run ID from the TFC run URL)" >&2
  exit 2
fi

TOKEN="${TFE_TOKEN:-}"
if [[ -z "$TOKEN" ]]; then
  TOKEN=$(jq -r --arg h "$TFE_HOST" '.credentials[$h].token // empty' \
    "$HOME/.terraform.d/credentials.tfrc.json" 2>/dev/null || true)
fi
if [[ -z "$TOKEN" ]]; then
  echo "no token: set TFE_TOKEN or run 'terraform login'" >&2
  exit 1
fi

API="https://$TFE_HOST/api/v2"
H=(-H "Authorization: Bearer $TOKEN" -H "Content-Type: application/vnd.api+json")

PLAN_ID=$(curl -s "${H[@]}" "$API/runs/$RUN_ID" | jq -r '.data.relationships.plan.data.id')
if [[ -z "$PLAN_ID" || "$PLAN_ID" == "null" ]]; then
  echo "could not resolve a plan for $RUN_ID (check the run ID and token access)" >&2
  exit 1
fi

# /json-output is unredacted (needs elevated workspace access); else redacted.
JSON=$(curl -sfL "${H[@]}" "$API/plans/$PLAN_ID/json-output" 2>/dev/null || true)
if [[ -z "$JSON" ]]; then
  echo "note: no access to unredacted plan; using json-output-redacted (sensitive values shown as '(sensitive)')" >&2
  JSON=$(curl -sfL "${H[@]}" "$API/plans/$PLAN_ID/json-output-redacted")
fi

echo "$JSON" | jq -r --arg filter "$FILTER" --argjson ws "$WS" '
  def fmt($v): if $v == null then "null" else ($v|tostring) end;
  def vis:
    gsub("\r"; "␍") | gsub("\t"; "→") | gsub(" "; "·") | gsub("\n"; "␊\n");
  def maybevis($ws):
    if $ws == 1 and (. != "(sensitive)") and (. != "(known after apply)") and (. != "null")
    then vis else . end;

  .resource_changes[]
  | select(.change.actions != ["no-op"])
  | select($filter == "" or (.address | contains($filter)) or (.type | contains($filter)))
  | (.change.before // {}) as $b
  | (.change.after  // {}) as $a
  | (.change.after_unknown    // {}) as $u
  | (.change.before_sensitive // {}) as $bs
  | (.change.after_sensitive  // {}) as $as
  | ( ([$b|paths(scalars)] + [$a|paths(scalars)]) | unique ) as $paths
  | [ $paths[]
      | . as $p
      | ($b|getpath($p)) as $bv
      | ($a|getpath($p)) as $av
      | select($bv != $av)
      | ($p|map(tostring)|join(".")) as $key
      | (if ($bv == null and (($bs|getpath($p)?) == true)) then "(sensitive)" else fmt($bv) end) as $bshow
      | (if ($u|getpath($p)?) == true then "(known after apply)"
         elif ($av == null and (($as|getpath($p)?) == true)) then "(sensitive)"
         else fmt($av) end) as $ashow
      | "  \($key):  \($bshow|maybevis($ws))  ->  \($ashow|maybevis($ws))" ] as $lines
  | "\(.address)  (\(.change.actions|join("+")))",
    (if ($lines|length) > 0 then $lines[] else "  (no attribute-value changes; metadata/order only)" end),
    ""
'
