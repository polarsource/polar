#!/bin/bash

set -e

openapi_file=openapi.yaml
config_file=docs.json

# Check if jq is installed
if ! command -v jq &> /dev/null; then
  echo "jq is not installed. Please install jq to use this script."
  exit 1
fi

# Check if there is exactly one positional argument
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <openapi_schema_url>"
  exit 1
fi

# Download latest OpenAPI schema
curl -s -o openapi.yaml "$1"
echo "Downloaded OpenAPI schema from $1"

# Create a new MDX file for each webhook, if it doesn't exist
file="$1"
jq -r '.webhooks | to_entries[] | "\(.key) \(.value.post.requestBody.content["application/json"].schema["$ref"])"' "$openapi_file" | while read -r key ref; do
  schema=${ref##*/}
  schema_page="api-reference/webhooks/$key"
  schema_file="./$schema_page.mdx"
  if [ ! -f "$schema_file" ]; then
    echo "Creating $schema_file"
    cat <<EOL > "$schema_file"
---
title: $key
openapi-schema: $schema
---
EOL
  # Add the $schema_file path to the docs navigation
  jq --arg schema_page "$schema_page" \
  '(.navigation.anchors[] | select(.anchor == "API Reference") | .groups[] | select(.group == "Webhooks") | .pages) += [$schema_page]' \
  "$config_file" > tmp.$$.json && mv tmp.$$.json "$config_file"
  else
    echo "$schema_file already exists, skipping"
  fi
done
