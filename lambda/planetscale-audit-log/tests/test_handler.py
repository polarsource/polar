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
    @classmethod
    def now(cls, tz: Any = None) -> "FrozenDatetime":
        return cls.fromtimestamp(NOW.timestamp(), tz)


def entry(id: str, minutes_ago: int) -> dict[str, Any]:
    created_at = NOW - timedelta(minutes=minutes_ago)
    return {"id": id, "created_at": created_at.strftime("%Y-%m-%dT%H:%M:%S.000Z")}


@pytest.fixture
def s3(monkeypatch: pytest.MonkeyPatch) -> Iterator[S3Client]:
    monkeypatch.setenv("BUCKET", BUCKET)
    monkeypatch.setenv("PLANETSCALE_ORGANIZATION", "polar")
    monkeypatch.setenv("PLANETSCALE_TOKEN", "pscale_tkn_secret")
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


def test_writes_last_complete_hours_oldest_first(
    s3: S3Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    pages = {
        None: {
            "has_next": True,
            "cursor_end": "c",
            "data": [entry("current-hour", 5), entry("b", 25), entry("a", 40)],
        },
        "c": {
            "has_next": True,
            "cursor_end": "e",
            "data": [entry("d", 145), entry("before-window", 210)],
        },
    }
    monkeypatch.setattr(handler_module, "fetch_page", pages.__getitem__)

    assert handler({}, None) == {"hours": 2, "entries": 3}
    assert objects(s3) == {
        "2026/11/27/14.jsonl": ["a", "b"],
        "2026/11/27/12.jsonl": ["d"],
    }


def test_stops_on_last_page(s3: S3Client, monkeypatch: pytest.MonkeyPatch) -> None:
    pages = {None: {"has_next": False, "cursor_end": "a", "data": [entry("a", 30)]}}
    monkeypatch.setattr(handler_module, "fetch_page", pages.__getitem__)

    assert handler({}, None) == {"hours": 1, "entries": 1}


def test_fetch_page_sends_token_and_cursor(
    s3: S3Client, monkeypatch: pytest.MonkeyPatch
) -> None:
    requests = []

    def urlopen(request: Any, timeout: int) -> io.BytesIO:
        requests.append(request)
        return io.BytesIO(b'{"data": []}')

    monkeypatch.setattr("urllib.request.urlopen", urlopen)

    handler_module.fetch_page("abc")

    assert requests[0].full_url == (
        "https://api.planetscale.com/v1/organizations/polar/audit-log"
        "?limit=100&starting_after=abc"
    )
    assert requests[0].get_header("Authorization") == "Bearer pscale_tkn_secret"
