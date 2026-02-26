import gzip
import json
import re
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime
from typing import Any

import boto3
import logfire
from botocore.config import Config
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult

REDACTED = "[Redacted]"


class S3SpanExporter(SpanExporter):
    def __init__(
        self,
        *,
        bucket_name: str,
        service_name: str,
        endpoint_url: str | None = None,
        aws_access_key_id: str | None = None,
        aws_secret_access_key: str | None = None,
        region_name: str = "us-east-2",
        scrub_patterns: Sequence[str] = (),
    ) -> None:
        self.bucket_name = bucket_name
        self.service_name = service_name
        self._scrub_re = (
            re.compile("|".join(scrub_patterns), re.IGNORECASE)
            if scrub_patterns
            else None
        )
        self._client = boto3.client(
            "s3",
            endpoint_url=endpoint_url,
            aws_access_key_id=aws_access_key_id,
            aws_secret_access_key=aws_secret_access_key,
            config=Config(
                region_name=region_name,
                connect_timeout=5,
                read_timeout=5,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )

    def _scrub_dict(self, d: dict[str, Any]) -> None:
        for key in d:
            if self._scrub_re and self._scrub_re.search(key):
                d[key] = REDACTED
            elif isinstance(d[key], dict):
                self._scrub_dict(d[key])
            elif isinstance(d[key], list):
                for item in d[key]:
                    if isinstance(item, dict):
                        self._scrub_dict(item)

    def _scrub_span_json(self, json_str: str) -> str:
        data = json.loads(json_str)
        if "attributes" in data:
            self._scrub_dict(data["attributes"])
        for entry in [*data.get("events", []), *data.get("links", [])]:
            if "attributes" in entry:
                self._scrub_dict(entry["attributes"])
        return json.dumps(data, separators=(",", ":"))

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        if not spans:
            return SpanExportResult.SUCCESS

        if self._scrub_re:
            lines = [self._scrub_span_json(span.to_json(indent=None)) for span in spans]
        else:
            lines = [span.to_json(indent=None) for span in spans]
        body = gzip.compress("\n".join(lines).encode())

        now = datetime.now(UTC)
        key = (
            f"spans/{self.service_name}"
            f"/dt={now.strftime('%Y-%m-%d')}"
            f"/{now.strftime('%H%M%S')}_{uuid.uuid4().hex}.jsonl.gz"
        )

        try:
            self._client.put_object(Bucket=self.bucket_name, Key=key, Body=body)
        except Exception:
            logfire.error("Failed to export spans to S3", _exc_info=True)
            return SpanExportResult.FAILURE

        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass
