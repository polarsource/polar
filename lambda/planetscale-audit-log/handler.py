import json
import os
import urllib.request
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from functools import cache
from typing import Any

import boto3

# An entry can reach the API a little after it happened, so an hour is only
# exported once it has been over for this long.
SETTLE = timedelta(minutes=15)

s3 = boto3.client("s3")
secretsmanager = boto3.client("secretsmanager")


@cache
def planetscale_token() -> str:
    secret = secretsmanager.get_secret_value(
        SecretId=os.environ["PLANETSCALE_TOKEN_SECRET_ARN"]
    )
    return secret["SecretString"]


def fetch_page(starting_after: str | None) -> dict[str, Any]:
    url = f"https://api.planetscale.com/v1/organizations/{os.environ['PLANETSCALE_ORGANIZATION']}/audit-log?limit=100"
    if starting_after:
        url += f"&starting_after={starting_after}"
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {planetscale_token()}"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


def audit_log() -> Iterator[dict[str, Any]]:
    cursor = None
    while True:
        page = fetch_page(cursor)
        yield from page["data"]
        if not page["has_next"]:
            return
        cursor = page["cursor_end"]


def start_of_hour(moment: datetime) -> datetime:
    return moment.replace(minute=0, second=0, microsecond=0)


def object_key(hour: datetime) -> str:
    return f"{hour:%Y/%m/%d/%H}.jsonl"


def exported(hour: datetime) -> bool:
    listing = s3.list_objects_v2(
        Bucket=os.environ["BUCKET"], Prefix=object_key(hour), MaxKeys=1
    )
    return listing["KeyCount"] > 0


# Entries come newest first. Walk back to the newest hour that is already in
# the bucket, then write the hours after it oldest first, one object each:
# a run that fails part way leaves no gap for the next one to skip over.
def handler(event: Any, context: Any) -> dict[str, int]:
    end = start_of_hour(datetime.now(UTC) - SETTLE)

    hours: dict[datetime, list[dict[str, Any]]] = {}
    for entry in audit_log():
        hour = start_of_hour(
            datetime.fromisoformat(entry["created_at"]).astimezone(UTC)
        )
        if hour >= end:
            continue
        if hour not in hours:
            if exported(hour):
                break
            hours[hour] = []
        hours[hour].append(entry)

    for hour, entries in reversed(hours.items()):
        s3.put_object(
            Bucket=os.environ["BUCKET"],
            Key=object_key(hour),
            Body="".join(json.dumps(entry) + "\n" for entry in reversed(entries)),
            ContentType="application/x-ndjson",
        )

    return {"hours": len(hours), "entries": sum(map(len, hours.values()))}
