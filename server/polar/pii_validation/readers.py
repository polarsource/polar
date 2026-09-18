import gzip
import json
import shlex
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import boto3
import httpx
from botocore.config import Config
from logfire.query_client import LogfireQueryClient

from polar.pii_validation.schemas import Manifest, ValidationRequest

MAX_RECORDS = 1000


class RenderClient:
    def __init__(self, client: httpx.Client, token: str, owner_id: str) -> None:
        self.client = client
        self.headers = {"Authorization": f"Bearer {token}"}
        self.owner_id = owner_id

    def request(self, method: str, path: str, **kwargs: Any) -> Any:
        response = self.client.request(
            method, f"https://api.render.com/v1{path}", headers=self.headers, **kwargs
        )
        response.raise_for_status()
        return response.json()

    def create_job(self, service_id: str, request: ValidationRequest) -> str:
        command = shlex.join(
            [
                "uv",
                "run",
                "python",
                "-m",
                "scripts.emit_pii_validation",
                "--run-id",
                str(request.run_id),
                "--release",
                request.release,
            ]
        )
        return str(
            self.request(
                "POST", f"/services/{service_id}/jobs", json={"startCommand": command}
            )["id"]
        )

    def logs(self, resource: str, start: datetime, text: str) -> list[dict[str, Any]]:
        params = {
            "ownerId": self.owner_id,
            "resource": resource,
            "startTime": start.isoformat(),
            "endTime": datetime.now(UTC).isoformat(),
            "text": text,
            "direction": "forward",
            "limit": "100",
        }
        records: list[dict[str, Any]] = []
        for _ in range(10):
            page = self.request("GET", "/logs", params=params)
            records.extend(page["logs"])
            if not page["hasMore"]:
                return records
            params["startTime"] = page["nextStartTime"]
            params["endTime"] = page["nextEndTime"]
        raise RuntimeError("Render log query exceeded the validation record limit")


def logfire_records(
    client: LogfireQueryClient, manifest: Manifest
) -> list[dict[str, Any]]:
    result = client.query_json_rows(
        f"SELECT * FROM records WHERE message LIKE '%{manifest.run_id}%'",
        min_timestamp=manifest.emitted_at - timedelta(seconds=30),
        max_timestamp=datetime.now(UTC),
        environment=manifest.environment,
        limit=MAX_RECORDS,
    )
    if len(result["rows"]) >= MAX_RECORDS:
        raise RuntimeError("Logfire query exceeded the validation record limit")
    return result["rows"]


class S3Reader:
    def __init__(self) -> None:
        self.client = boto3.client(
            "s3",
            config=Config(
                connect_timeout=5, read_timeout=10, retries={"max_attempts": 2}
            ),
        )
        self.seen: set[tuple[str, str]] = set()
        self.records: list[dict[str, Any]] = []
        self.bytes_read = 0
        self.decompressed_bytes = 0

    def prefixes(self, manifest: Manifest) -> Iterator[str]:
        hour = (manifest.emitted_at - timedelta(seconds=30)).replace(
            minute=0, second=0, microsecond=0
        )
        while hour <= datetime.now(UTC):
            yield f"spans/{manifest.service_name}/dt={hour:%Y-%m-%d}/hour={hour:%H}/"
            hour += timedelta(hours=1)

    def read(self, manifest: Manifest) -> list[dict[str, Any]]:
        if manifest.s3_bucket is None:
            raise RuntimeError("S3 export is not configured")
        start = manifest.emitted_at - timedelta(seconds=30)
        for prefix in self.prefixes(manifest):
            page = self.client.list_objects_v2(
                Bucket=manifest.s3_bucket,
                Prefix=prefix,
                MaxKeys=1000,
                StartAfter=prefix + start.strftime("%M%S")
                if prefix.endswith(f"/dt={start:%Y-%m-%d}/hour={start:%H}/")
                else prefix,
            )
            if page.get("IsTruncated"):
                raise RuntimeError("S3 query exceeded the validation object limit")
            for item in page.get("Contents", []):
                key = item["Key"]
                identity = (manifest.s3_bucket, key)
                if identity in self.seen or item[
                    "LastModified"
                ] < manifest.emitted_at - timedelta(seconds=30):
                    continue
                self.bytes_read += item["Size"]
                if self.bytes_read > 64 * 1024 * 1024:
                    raise RuntimeError("S3 query exceeded the validation byte limit")
                response = self.client.get_object(Bucket=manifest.s3_bucket, Key=key)
                with response["Body"] as body, gzip.GzipFile(fileobj=body) as archive:
                    data = archive.read(32 * 1024 * 1024 + 1)
                self.decompressed_bytes += len(data)
                if (
                    len(data) > 32 * 1024 * 1024
                    or self.decompressed_bytes > 256 * 1024 * 1024
                ):
                    raise RuntimeError(
                        "S3 log batch exceeded the validation decompression limit"
                    )
                for line in data.decode().splitlines():
                    if str(manifest.run_id) in line:
                        self.records.append(json.loads(line))
                        if len(self.records) >= MAX_RECORDS:
                            raise RuntimeError(
                                "S3 query exceeded the validation record limit"
                            )
                self.seen.add(identity)
        return self.records
