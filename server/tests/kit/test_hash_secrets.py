from typing import Any
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.config import settings
from polar.kit.hash_secrets import (
    HashSecretsError,
    _fetch_hash_secrets,
    get_hash_secrets,
)

ARN = "arn:aws:secretsmanager:us-east-2:1:secret:polar-test-hash-secret"


@pytest.fixture(autouse=True)
def clear_cache() -> Any:
    _fetch_hash_secrets.cache_clear()
    yield
    _fetch_hash_secrets.cache_clear()


def stub_client(mocker: MockerFixture, versions: list[dict[str, Any]]) -> MagicMock:
    client = MagicMock()
    # One version per page, chained by NextToken, so the tests walk the loop.
    pages = [
        {"Versions": [version], "NextToken": str(index + 1)}
        if index + 1 < len(versions)
        else {"Versions": [version]}
        for index, version in enumerate(versions)
    ]
    client.list_secret_version_ids.side_effect = lambda **kwargs: pages[
        int(kwargs.get("NextToken", 0))
    ]
    client.get_secret_value.side_effect = lambda SecretId, VersionId: {
        "SecretString": f"secret-for-{VersionId}"
    }
    mocker.patch("polar.kit.hash_secrets._client", return_value=client)
    return client


def test_reads_the_settings_without_an_arn(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", None)
    monkeypatch.setattr(settings, "HASH_SECRETS", {"k1": "local"})
    monkeypatch.setattr(settings, "CURRENT_HASH_SECRET_ID", "k1")

    assert get_hash_secrets() == ({"k1": "local"}, "k1", settings.SECRET)


def test_builds_the_set_from_the_versions(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    stub_client(
        mocker,
        [
            {"VersionId": "v1", "VersionStages": ["k1", "LEGACY", "AWSPREVIOUS"]},
            {"VersionId": "v2", "VersionStages": ["k2", "AWSCURRENT"]},
        ],
    )

    hash_secrets = get_hash_secrets()

    assert hash_secrets.secrets == {"k1": "secret-for-v1", "k2": "secret-for-v2"}
    assert hash_secrets.current_id == "k2"
    assert hash_secrets.legacy == "secret-for-v1"


def test_fetches_once_per_process(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    client = stub_client(
        mocker,
        [{"VersionId": "v1", "VersionStages": ["k1", "LEGACY", "AWSCURRENT"]}],
    )

    get_hash_secrets()
    get_hash_secrets()

    assert client.list_secret_version_ids.call_count == 1


def test_ignores_a_version_left_with_only_awsprevious(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    """Moving AWSCURRENT leaves the old version labelled but with no id."""
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    stub_client(
        mocker,
        [
            {"VersionId": "v1", "VersionStages": ["AWSPREVIOUS"]},
            {"VersionId": "v2", "VersionStages": ["k2", "LEGACY", "AWSCURRENT"]},
        ],
    )

    hash_secrets = get_hash_secrets()

    assert hash_secrets.secrets == {"k2": "secret-for-v2"}
    assert hash_secrets.current_id == "k2"


def test_rejects_a_version_with_two_ids(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    stub_client(
        mocker, [{"VersionId": "v1", "VersionStages": ["k1", "k2", "AWSCURRENT"]}]
    )

    with pytest.raises(HashSecretsError, match="custom staging labels"):
        get_hash_secrets()


def test_rejects_a_secret_with_no_current_version(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    stub_client(
        mocker, [{"VersionId": "v1", "VersionStages": ["k1", "LEGACY", "AWSPREVIOUS"]}]
    )

    with pytest.raises(HashSecretsError, match="AWSCURRENT"):
        get_hash_secrets()


def test_falls_back_to_the_settings_secret_without_a_legacy_version(
    mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "AWS_HASH_SECRET_ARN", ARN)
    monkeypatch.setattr(settings, "SECRET", "from-the-environment")
    stub_client(mocker, [{"VersionId": "v1", "VersionStages": ["k1", "AWSCURRENT"]}])

    assert get_hash_secrets().legacy == "from-the-environment"
