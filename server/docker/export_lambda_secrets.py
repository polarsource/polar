import json
import os
import re
import shlex

import boto3

params = {"SecretId": os.environ["POLAR_WORKER_SECRETS_ARN"]}
version_id = os.environ.get("POLAR_WORKER_SECRETS_VERSION")
if version_id:
    params["VersionId"] = version_id
secret = boto3.client("secretsmanager").get_secret_value(**params)
for key, value in json.loads(secret["SecretString"]).items():
    if not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", key):
        raise ValueError(f"invalid env var name: {key!r}")
    print(f"export {key}={shlex.quote(value)}")
