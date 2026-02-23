import json
import sys

from polar.app import create_app

if __name__ == "__main__":
    schema = create_app().openapi()
    json.dump(schema, sys.stdout)
    sys.stdout.flush()
