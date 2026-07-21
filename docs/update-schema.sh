#!/bin/bash

set -e

openapi_file=openapi.yaml

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
curl -s "$1" | jq -M '.' > "$openapi_file"
echo "Downloaded OpenAPI schema from $1"
