import gzip
import json
import os
import subprocess
import sys
import textwrap
from collections.abc import Iterator
from pathlib import Path
from typing import Any
from unittest.mock import patch

import pytest
from minio import Minio
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import SimpleSpanProcessor

from polar.config import settings
from polar.observability.s3_span_exporter import REDACTED, S3SpanExporter

BUCKET_NAME = "testing-s3-span-exporter"


class TestExportFailure:
    @pytest.mark.parametrize("warm_log_tracer", [False, True])
    def test_flush_returns_after_s3_access_denied(
        self, warm_log_tracer: bool, tmp_path: Path
    ) -> None:
        result = subprocess.run(
            [
                sys.executable,
                "-c",
                textwrap.dedent(
                    """
                    import sys
                    from unittest.mock import Mock, patch

                    import logfire
                    from botocore.exceptions import ClientError
                    from opentelemetry.sdk.trace.export import BatchSpanProcessor

                    from polar.logging import Production
                    from polar.observability.s3_span_exporter import S3SpanExporter

                    client = Mock()
                    client.put_object.side_effect = ClientError(
                        {"Error": {"Code": "AccessDenied", "Message": "Denied"}},
                        "PutObject",
                    )
                    with patch("boto3.client", return_value=client):
                        exporter = S3SpanExporter(bucket_name="unused", service_name="test")
                    logfire.configure(
                        send_to_logfire=False,
                        console=False,
                        inspect_arguments=False,
                        additional_span_processors=[
                            BatchSpanProcessor(exporter, schedule_delay_millis=60000)
                        ],
                    )
                    Production.configure(logfire=True)
                    if sys.argv[1] == "True":
                        logfire.info("Existing application log")
                    with logfire.span("Completed task"):
                        pass
                    assert logfire.force_flush(timeout_millis=100)
                    assert client.put_object.call_count == 1
                    """
                ),
                str(warm_log_tracer),
            ],
            capture_output=True,
            env={**os.environ, "PROMETHEUS_MULTIPROC_DIR": str(tmp_path)},
            text=True,
            timeout=10,
            check=False,
        )

        assert result.returncode == 0, result.stderr
        assert "AccessDenied" in result.stderr


def _empty_bucket(minio_client: Minio) -> None:
    objects = minio_client.list_objects(BUCKET_NAME, recursive=True)
    for obj in objects:
        minio_client.remove_object(BUCKET_NAME, obj.object_name)


@pytest.fixture(scope="module")
def minio_client() -> Minio:
    if not settings.S3_ENDPOINT_URL:
        pytest.skip("S3_ENDPOINT_URL not set")

    return Minio(
        endpoint=settings.S3_ENDPOINT_URL.removeprefix("http://").removeprefix(
            "https://"
        ),
        access_key=settings.MINIO_USER,
        secret_key=settings.MINIO_PWD,
        secure=False,
    )


@pytest.fixture(scope="module")
def s3_bucket(minio_client: Minio) -> Iterator[Any]:
    if minio_client.bucket_exists(BUCKET_NAME):
        _empty_bucket(minio_client)
        minio_client.remove_bucket(BUCKET_NAME)

    minio_client.make_bucket(BUCKET_NAME)

    yield

    _empty_bucket(minio_client)
    minio_client.remove_bucket(BUCKET_NAME)


@pytest.fixture
def exporter() -> S3SpanExporter:
    return S3SpanExporter(
        bucket_name=BUCKET_NAME,
        service_name="test-service",
        endpoint_url=settings.S3_ENDPOINT_URL,
        aws_access_key_id=settings.MINIO_USER,
        aws_secret_access_key=settings.MINIO_PWD,
        region_name=settings.AWS_REGION,
    )


def test_export_writes_jsonl_to_s3(
    s3_bucket: Any, minio_client: Minio, exporter: S3SpanExporter
) -> None:
    provider = TracerProvider()
    provider.add_span_processor(SimpleSpanProcessor(exporter))
    tracer = provider.get_tracer("test")

    with tracer.start_as_current_span("test-span"):
        pass

    provider.shutdown()

    objects = list(
        minio_client.list_objects(
            BUCKET_NAME, prefix="spans/test-service/", recursive=True
        )
    )
    assert len(objects) == 1

    key = objects[0].object_name
    assert key is not None
    assert key.endswith(".jsonl.gz")
    assert "/dt=" in key

    response = minio_client.get_object(BUCKET_NAME, key)
    body = gzip.decompress(response.read()).decode()
    response.close()
    response.release_conn()

    span_data = json.loads(body)
    assert span_data["name"] == "test-span"


@pytest.fixture
def scrubbing_exporter() -> S3SpanExporter:
    with patch("polar.observability.s3_span_exporter.boto3"):
        return S3SpanExporter(
            bucket_name="unused",
            service_name="test",
            scrub_patterns=[r"email", r"user\.?name", r"cookie"],
        )


class TestScrubbing:
    def test_scrubs_matching_attributes(
        self, scrubbing_exporter: S3SpanExporter
    ) -> None:
        span_json = json.dumps(
            {
                "name": "GET /users",
                "attributes": {
                    "user.email": "alice@example.com",
                    "username": "alice",
                    "http.method": "GET",
                    "http.route": "/users",
                },
            }
        )
        result = json.loads(scrubbing_exporter._scrub_span_json(span_json))
        assert result["attributes"]["user.email"] == REDACTED
        assert result["attributes"]["username"] == REDACTED
        assert result["attributes"]["http.method"] == "GET"
        assert result["attributes"]["http.route"] == "/users"
        assert result["name"] == "GET /users"

    def test_scrubs_event_attributes(self, scrubbing_exporter: S3SpanExporter) -> None:
        span_json = json.dumps(
            {
                "name": "request",
                "attributes": {},
                "events": [
                    {
                        "name": "log",
                        "attributes": {
                            "email": "bob@example.com",
                            "message": "hello",
                        },
                    }
                ],
            }
        )
        result = json.loads(scrubbing_exporter._scrub_span_json(span_json))
        assert result["events"][0]["attributes"]["email"] == REDACTED
        assert result["events"][0]["attributes"]["message"] == "hello"

    def test_scrubs_nested_dicts(self, scrubbing_exporter: S3SpanExporter) -> None:
        span_json = json.dumps(
            {
                "name": "request",
                "attributes": {
                    "http.request.header.cookie": "session=abc123",
                    "nested": {"email": "nested@example.com"},
                },
            }
        )
        result = json.loads(scrubbing_exporter._scrub_span_json(span_json))
        assert result["attributes"]["http.request.header.cookie"] == REDACTED
        assert result["attributes"]["nested"]["email"] == REDACTED

    def test_case_insensitive(self, scrubbing_exporter: S3SpanExporter) -> None:
        span_json = json.dumps(
            {
                "name": "request",
                "attributes": {"Email": "test@test.com", "USERNAME": "test"},
            }
        )
        result = json.loads(scrubbing_exporter._scrub_span_json(span_json))
        assert result["attributes"]["Email"] == REDACTED
        assert result["attributes"]["USERNAME"] == REDACTED

    def test_no_scrubbing_without_patterns(self) -> None:
        with patch("polar.observability.s3_span_exporter.boto3"):
            exporter = S3SpanExporter(
                bucket_name="unused",
                service_name="test",
            )
        assert exporter._scrub_re is None
