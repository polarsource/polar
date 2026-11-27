import json
import os
import urllib.request
from datetime import UTC, datetime, timedelta

import boto3

LOOKBACK = timedelta(days=1)

s3 = boto3.client("s3")


def fetch_page(starting_after: str | None) -> dict:
    url = f"https://api.planetscale.com/v1/organizations/{os.environ['PLANETSCALE_ORGANIZATION']}/audit-log?limit=100"
    if starting_after:
        url += f"&starting_after={starting_after}"
    request = urllib.request.Request(
        url, headers={"Authorization": f"Bearer {os.environ['PLANETSCALE_TOKEN']}"}
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        return json.load(response)


# Entries come newest first. Re-exporting the last day on every hourly run
# rides out failed runs; an entry always lands on the same key.
def handler(event, context):
    cutoff = datetime.now(UTC) - LOOKBACK
    cursor = None
    exported = 0
    while True:
        page = fetch_page(cursor)
        for entry in page["data"]:
            created_at = datetime.fromisoformat(entry["created_at"])
            if created_at < cutoff:
                return {"exported": exported}
            s3.put_object(
                Bucket=os.environ["BUCKET"],
                Key=f"{created_at:%Y/%m/%d}/{entry['id']}.json",
                Body=json.dumps(entry),
                ContentType="application/json",
            )
            exported += 1
        if not page["has_next"]:
            return {"exported": exported}
        cursor = page["cursor_end"]
