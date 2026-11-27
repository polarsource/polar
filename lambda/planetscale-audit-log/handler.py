import json
import os
import urllib.request
from collections import defaultdict
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3

HOURS = 3

s3 = boto3.client("s3")


def fetch_page(starting_after: str | None) -> dict[str, Any]:
    url = f"https://api.planetscale.com/v1/organizations/{os.environ['PLANETSCALE_ORGANIZATION']}/audit-log?limit=100"
    if starting_after:
        url += f"&starting_after={starting_after}"
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {os.environ['PLANETSCALE_TOKEN']}"}
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


# Entries come newest first. Each run rewrites the last few complete hours,
# one object per hour, so the next run redoes the work of a failed one.
def handler(event: Any, context: Any) -> dict[str, int]:
    end = datetime.now(UTC).replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(hours=HOURS)

    hours: dict[datetime, list[dict[str, Any]]] = defaultdict(list)
    for entry in audit_log():
        created_at = datetime.fromisoformat(entry["created_at"]).astimezone(UTC)
        if created_at < start:
            break
        if created_at < end:
            hours[created_at.replace(minute=0, second=0, microsecond=0)].append(entry)

    for hour, entries in hours.items():
        s3.put_object(
            Bucket=os.environ["BUCKET"],
            Key=f"{hour:%Y/%m/%d/%H}.jsonl",
            Body="".join(json.dumps(entry) + "\n" for entry in reversed(entries)),
            ContentType="application/x-ndjson",
        )

    return {"hours": len(hours), "entries": sum(map(len, hours.values()))}
