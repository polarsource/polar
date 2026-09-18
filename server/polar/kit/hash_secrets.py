import functools
from typing import Any, NamedTuple

from polar.config import settings

# The version carrying this label is the one bare digests were computed with.
LEGACY_STAGE = "LEGACY"
AWS_MANAGED_STAGES = {"AWSCURRENT", "AWSPREVIOUS", "AWSPENDING"}
RESERVED_STAGES = AWS_MANAGED_STAGES | {LEGACY_STAGE}


class HashSecretsError(Exception):
    pass


class HashSecrets(NamedTuple):
    secrets: dict[str, str]
    current_id: str | None
    legacy: str


def get_hash_secrets() -> HashSecrets:
    """Do not cache this: the fetch is cached instead, so local settings stay
    readable."""
    arn = settings.AWS_HASH_SECRET_ARN
    if arn is None:
        return HashSecrets(
            settings.HASH_SECRETS, settings.CURRENT_HASH_SECRET_ID, settings.SECRET
        )
    return _fetch_hash_secrets(arn)


def _client() -> Any:
    import boto3
    from botocore.config import Config

    from polar.kit.aws import get_credentials

    access_key_id, secret_access_key = get_credentials()
    return boto3.client(
        "secretsmanager",
        region_name=settings.AWS_REGION,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(
            connect_timeout=3,
            read_timeout=5,
            retries={"max_attempts": 3, "mode": "standard"},
        ),
    )


@functools.cache
def _fetch_hash_secrets(arn: str) -> HashSecrets:
    """One fetch per process. A rotation applies on the next deploy."""
    client = _client()
    secrets: dict[str, str] = {}
    current: str | None = None
    legacy: str | None = None

    paginator = client.get_paginator("list_secret_version_ids")
    pages = paginator.paginate(SecretId=arn, IncludeDeprecated=False)
    for version in (v for page in pages for v in page["Versions"]):
        stages = set(version["VersionStages"])
        labels = stages - RESERVED_STAGES
        if len(labels) != 1:
            raise HashSecretsError(
                f"Version {version['VersionId']} of {arn} carries {len(labels)} "
                "custom staging labels, expected exactly one"
            )
        secret_id = labels.pop()
        secret = client.get_secret_value(SecretId=arn, VersionId=version["VersionId"])[
            "SecretString"
        ]
        secrets[secret_id] = secret
        if "AWSCURRENT" in stages:
            current = secret_id
        if LEGACY_STAGE in stages:
            legacy = secret

    if current is None:
        raise HashSecretsError(f"No AWSCURRENT version on {arn}")
    if legacy is None:
        raise HashSecretsError(f"No {LEGACY_STAGE} version on {arn}")

    return HashSecrets(secrets, current, legacy)
