import functools
from collections.abc import Iterator
from typing import Any

from polar.config import settings

AWS_MANAGED_STAGES = {"AWSCURRENT", "AWSPREVIOUS", "AWSPENDING"}


class HashSecretsError(Exception):
    pass


def get_hash_secrets() -> tuple[dict[str, str], str | None]:
    """The secrets every hash is checked against, and the id new hashes carry.

    Do not cache this: the fetch is cached instead, so local settings stay
    readable.
    """
    arn = settings.AWS_HASH_SECRET_ARN
    if arn is None:
        return settings.HASH_SECRETS, settings.CURRENT_HASH_SECRET_ID
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


def _iter_versions(client: Any, arn: str) -> Iterator[dict[str, Any]]:
    """ListSecretVersionIds has no botocore paginator, so follow NextToken."""
    next_token: str | None = None
    while True:
        arguments: dict[str, Any] = {"SecretId": arn, "IncludeDeprecated": False}
        if next_token is not None:
            arguments["NextToken"] = next_token
        page = client.list_secret_version_ids(**arguments)
        yield from page["Versions"]
        next_token = page.get("NextToken")
        if next_token is None:
            return


@functools.cache
def _fetch_hash_secrets(arn: str) -> tuple[dict[str, str], str | None]:
    """One fetch per process. A rotation applies on the next deploy."""
    client = _client()
    secrets: dict[str, str] = {}
    current: str | None = None

    for version in _iter_versions(client, arn):
        stages = set(version["VersionStages"])
        labels = stages - AWS_MANAGED_STAGES
        if len(labels) != 1:
            raise HashSecretsError(
                f"Version {version['VersionId']} of {arn} carries {len(labels)} "
                "custom staging labels, expected exactly one"
            )
        secret_id = labels.pop()
        value = client.get_secret_value(SecretId=arn, VersionId=version["VersionId"])
        secrets[secret_id] = value["SecretString"]
        if "AWSCURRENT" in stages:
            current = secret_id

    if current is None:
        raise HashSecretsError(f"No AWSCURRENT version on {arn}")

    return secrets, current
