import json
import os
import sys

# Force `zoneinfo` to ignore system tzdata and use the bundled `tzdata` PyPI
# package, so the OpenAPI timezone enum is identical across CI and dev machines.
os.environ["PYTHONTZPATH"] = ""

from polar.app import create_app

if __name__ == "__main__":
    schema = create_app().openapi()
    json.dump(schema, sys.stdout)
    sys.stdout.flush()
