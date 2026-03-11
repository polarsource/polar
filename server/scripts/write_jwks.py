"""Write POLAR_JWKS_CONTENT env var to /tmp/jwks.json.

Used by Render cron jobs which don't support secret_files mounting.
"""

import os
import sys

content = os.environ.get("POLAR_JWKS_CONTENT")
if not content:
    print("POLAR_JWKS_CONTENT is not set", file=sys.stderr)
    sys.exit(1)

with open("/tmp/jwks.json", "w") as f:
    f.write(content)
