#!/bin/bash

set -e

# Get the directory of the script
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Get SCHEMA_URL and LANGUAGES input
if [ -z "$1" ]; then
  echo "SCHEMA_URL is not provided"
  exit 1
fi
if [ -z "$2" ]; then
  echo "LANGUAGES is not provided"
  exit 1
fi
SCHEMA_URL=$1
LANGUAGES=$2

# Download schema and convert to YAML
curl -o source.json $SCHEMA_URL
cat source.json | yq -P > source.yml

# Download code samples overlays and combine them
IFS=',' read -r -a languages <<< "$LANGUAGES"
for lang in "${languages[@]}"; do
  curl -o "codeSamples.${lang}.yml" "https://raw.githubusercontent.com/polarsource/polar-${lang}/main/codeSamples.yaml"
done
yq eval-all 'select(fileIndex == 0) as $first | .actions as $actions ireduce ({}; .actions += $actions) | .overlay = $first.overlay | .info = $first.info' codeSamples.* > overlay.yml

# Apply code samples overlay and convert to JSON
speakeasy overlay apply -s source.yml -o overlay.yml --out schema.yml
cat schema.yml | yq -o json > schema.json

# Clean up
rm source.json source.yml codeSamples.* overlay.yml schema.yml
