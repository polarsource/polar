import gzip
import uuid
from collections.abc import Sequence
from datetime import UTC, datetime

import boto3
import logfire
from botocore.config import Config
from opentelemetry.sdk.trace import ReadableSpan
from opentelemetry.sdk.trace.export import SpanExporter, SpanExportResult


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
    ) -> None:
        self.bucket_name = bucket_name
        self.service_name = service_name
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

    def export(self, spans: Sequence[ReadableSpan]) -> SpanExportResult:
        if not spans:
            return SpanExportResult.SUCCESS

        lines = [span.to_json(indent=None) for span in spans]
        body = gzip.compress("\n".join(lines).encode())

        now = datetime.now(UTC)
        key = (
            f"spans/{self.service_name}"
            f"/dt={now.strftime('%Y-%m-%d')}"
            f"/hour={now.strftime('%H')}"
            f"/{now.strftime('%M%S')}_{uuid.uuid4().hex}.jsonl.gz"
        )

        try:
            self._client.put_object(Bucket=self.bucket_name, Key=key, Body=body)
        except Exception:
            logfire.error("Failed to export spans to S3", _exc_info=True)
            return SpanExportResult.FAILURE

        return SpanExportResult.SUCCESS

    def shutdown(self) -> None:
        pass
