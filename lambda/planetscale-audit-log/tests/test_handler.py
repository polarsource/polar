import io
import json
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3
import pytest
from moto import mock_aws
from mypy_boto3_s3 import S3Client

import handler as handler_module
from handler import handler

BUCKET = "audit-log"
NOW = datetime(2026, 11, 27, 15, 20, tzinfo=UTC)


class FrozenDatetime(datetime):
    moment = NOW

    @classmethod
    def now(cls, tz: Any = None) -> "FrozenDatetime":
        return cls.fromtimestamp(cls.moment.timestamp(), tz)


def entry(id: str, minutes_ago: int) -> dict[str, Any]:
    created_at = NOW - timedelta(minutes=minutes_ago)
    return {"id": id, "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")}


def serve(monkeypatch: pytest.MonkeyPatch, *pages: list[dict[str, Any]]) -> None:
    responses = {
        None if index == 0 else str(index): {
            "data": data,
            "has_next": index < len(pages) - 1,
            "cursor_end": str(index + 1),
        }
        for index, data in enumerate(pages)
    }
    monkeypatch.setattr(handler_module, "fetch_page", responses.__getitem__)


@pytest.fixture
def s3(monkeypatch: pytest.MonkeyPatch) -> Iterator[S3Client]:
    monkeypatch.setenv("BUCKET", BUCKET)
    monkeypatch.setenv("PLANETSCALE_ORGANIZATION", "polar")
    monkeypatch.setattr(handler_module, "datetime", FrozenDatetime)
    with mock_aws():
        client = boto3.client("s3", region_name="us-east-1")
        client.create_bucket(Bucket=BUCKET)
        monkeypatch.setattr(handler_module, "s3", client)
        yield client


def objects(s3: S3Client) -> dict[str, list[str]]:
    keys = [o["Key"] for o in s3.list_objects_v2(Bucket=BUCKET).get("Contents", [])]
    return {
        key: [
            json.loads(line)["id"]
            for line in s3.get_object(Bucket=BUCKET, Key=key)["Body"]
            .read()
            .splitlines()
        ]
        for key in keys
    }


def test_backfills_every_settled_hour_oldest_first(
    s3: S3Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    serve(
        monkeypatch,
        [entry("unsettled", 5), entry("b", 25), entry("a", 40)],
        [entry("d", 145), entry("c", 3000)],
    )
    written = []
    put_object = s3.put_object

    def spy(**kwargs: Any) -> Any:
        written.append(kwargs["Key"])
        return put_object(**kwargs)

    monkeypatch.setattr(s3, "put_object", spy)

    assert handler({}, None) == {"hours": 3, "entries": 4}
    assert written == [
        "2026/11/25/13.jsonl",
        "2026/11/27/12.jsonl",
        "2026/11/27/14.jsonl",
    ]
    assert objects(s3) == {
        "2026/11/25/13.jsonl": ["c"],
        "2026/11/27/12.jsonl": ["d"],
        "2026/11/27/14.jsonl": ["a", "b"],
    }


def test_stops_at_the_newest_exported_hour(
    s3: S3Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    s3.put_object(Bucket=BUCKET, Key="2026/11/27/12.jsonl", Body=b"")
    serve(
        monkeypatch,
        [entry("b", 25), entry("a", 145)],
        [entry("never-fetched", 3000)],
    )

    assert handler({}, None) == {"hours": 1, "entries": 1}
    assert objects(s3)["2026/11/27/14.jsonl"] == ["b"]
    assert objects(s3)["2026/11/27/12.jsonl"] == []


def test_waits_for_the_last_hour_to_settle(
    s3: S3Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(FrozenDatetime, "moment", NOW - timedelta(minutes=11))
    serve(monkeypatch, [entry("b", 25), entry("a", 145)])

    assert handler({}, None) == {"hours": 1, "entries": 1}
    assert objects(s3) == {"2026/11/27/12.jsonl": ["a"]}


def test_fetch_page_sends_token_and_cursor(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("PLANETSCALE_ORGANIZATION", "polar")
    requests = []

    def urlopen(request: Any, timeout: int) -> io.BytesIO:
        requests.append(request)
        return io.BytesIO(b'{"data": []}')

    monkeypatch.setattr("urllib.request.urlopen", urlopen)
    with mock_aws():
        secretsmanager = boto3.client("secretsmanager", region_name="us-east-1")
        secret = secretsmanager.create_secret(
            Name="token", SecretString="pscale_tkn_secret"
        )
        monkeypatch.setenv("PLANETSCALE_TOKEN_SECRET_ARN", secret["ARN"])
        monkeypatch.setattr(handler_module, "secretsmanager", secretsmanager)
        handler_module.planetscale_token.cache_clear()

        handler_module.fetch_page("abc")

    assert requests[0].full_url == (
        "https://api.planetscale.com/v1/organizations/polar/audit-log"
        "?limit=100&starting_after=abc"
    )
    assert requests[0].get_header("Authorization") == "Bearer pscale_tkn_secret"
