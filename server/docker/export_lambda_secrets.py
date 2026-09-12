import json
import os
import re
import shlex

import boto3

ENV_VAR_NAME_PATTERN = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def export_secrets(secret_string: str) -> str:
    lines = []
    for key, value in json.loads(secret_string).items():
        if not ENV_VAR_NAME_PATTERN.fullmatch(key):
            raise ValueError(f"invalid env var name: {key!r}")
        lines.append(f"export {key}={shlex.quote(str(value))}")
    return "\n".join(lines)


if __name__ == "__main__":
    params = {"SecretId": os.environ["POLAR_WORKER_SECRETS_ARN"]}
    version_id = os.environ.get("POLAR_WORKER_SECRETS_VERSION")
    if version_id:
        params["VersionId"] = version_id
    secret = boto3.client("secretsmanager").get_secret_value(**params)
    print(export_secrets(secret["SecretString"]))
