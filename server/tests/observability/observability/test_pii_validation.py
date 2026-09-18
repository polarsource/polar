import gzip
import json
from datetime import UTC, datetime
from io import BytesIO
from itertools import count
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
import logfire
import pytest
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pytest_mock import MockerFixture

from polar.logging import Production
from polar.pii_validation.cases import (
    MANIFEST_PREFIX,
    SPAN_CASES,
    customer_id,
    marker,
    sensitive_fields,
)
from polar.pii_validation.readers import (
    RenderClient,
    S3Reader,
)
from polar.pii_validation.schemas import (
    Manifest,
    ValidationRequest,
)
from polar.pii_validation.verification import verify_records
from scripts.emit_pii_validation import emit
from scripts.validate_pii import main, run

from .conftest import LoggingPipeline


@pytest.fixture
def manifest() -> Manifest:
    return Manifest(
        run_id=uuid4(),
        release="a" * 40,
        environment="testing",
        emitted_at=datetime.now(UTC),
        service_name="api",
        logfire_enabled=True,
        s3_bucket="logs",
    )


@pytest.fixture
def stored_records(manifest: Manifest) -> list[dict[str, Any]]:
    return [
        {
            "message": marker(manifest.run_id, case),
            "email": "[Redacted]",
            "customer_id": customer_id(manifest.run_id),
            "exception_type": "ValueError",
        }
        for case in SPAN_CASES
    ]


class TestVerification:
    def test_complete_sample(
        self, manifest: Manifest, stored_records: list[dict[str, Any]]
    ) -> None:
        result = verify_records(stored_records, manifest, "s3")
        assert result["status"] == "passed"
        assert result["records_checked"] == 4

    def test_missing_events_are_not_success(
        self, manifest: Manifest, stored_records: list[dict[str, Any]]
    ) -> None:
        result = verify_records(stored_records[:-1], manifest, "s3")
        assert result["status"] == "pending"
        assert result["missing_cases"] == ["logfire"]
        assert verify_records([], manifest, "render")["status"] == "pending"

    def test_nested_leak_reports_only_field_names(
        self, manifest: Manifest, stored_records: list[dict[str, Any]]
    ) -> None:
        email = sensitive_fields(manifest.run_id)["email"]
        stored_records[0]["metadata"] = {"original_value": email}
        result = verify_records(stored_records, manifest, "s3")
        assert result["status"] == "failed"
        assert result["leaked_fields"] == ["email"]
        assert email not in json.dumps(result)

    @pytest.mark.parametrize("field", ["email", "customer_id"])
    def test_redaction_and_safe_identity_are_required(
        self, field: str, manifest: Manifest, stored_records: list[dict[str, Any]]
    ) -> None:
        del stored_records[0][field]
        result = verify_records(stored_records, manifest, "s3")
        assert result["status"] == "failed"
        assert result["invalid_cases"] == ["structured"]


class TestEmission:
    def test_wrong_release_never_initializes_exporters(
        self, manifest: Manifest, mocker: MockerFixture, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        monkeypatch.setenv("RELEASE_VERSION", "c" * 40)
        initialize = mocker.patch("scripts.emit_pii_validation.configure_logfire")
        with pytest.raises(RuntimeError, match="release mismatch"):
            emit(ValidationRequest(run_id=manifest.run_id, release=manifest.release))
        initialize.assert_not_called()

    @pytest.mark.parametrize("logging_pipeline", [(Production, True)], indirect=True)
    def test_actual_logging_payloads(
        self,
        manifest: Manifest,
        logging_pipeline: LoggingPipeline,
        configured_logfire: tuple[logfire.Logfire, InMemorySpanExporter],
        mocker: MockerFixture,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        logger, _, stream, exporter = logging_pipeline
        instance, _ = configured_logfire
        assert exporter is not None
        monkeypatch.setenv("RELEASE_VERSION", manifest.release)
        monkeypatch.setenv("RENDER_SERVICE_NAME", manifest.service_name)
        mocker.patch(
            "scripts.emit_pii_validation.structlog.get_logger", return_value=logger
        )
        mocker.patch("scripts.emit_pii_validation.logfire.log", instance.log)
        configure_logfire_mock = mocker.patch(
            "scripts.emit_pii_validation.configure_logfire"
        )
        configure_logging_mock = mocker.patch(
            "scripts.emit_pii_validation.configure_logging"
        )
        flush = mocker.patch(
            "scripts.emit_pii_validation.logfire.force_flush",
            side_effect=instance.force_flush,
        )
        emitted = emit(
            ValidationRequest(run_id=manifest.run_id, release=manifest.release)
        )
        configure_logfire_mock.assert_called_once_with("server")
        configure_logging_mock.assert_called_once_with(logfire=True)
        flush.assert_called_once_with(timeout_millis=30_000)
        assert emitted.run_id == manifest.run_id
        platform_records = [json.loads(line) for line in stream.getvalue().splitlines()]
        spans = [json.loads(span.to_json()) for span in exporter.get_finished_spans()]
        assert (
            verify_records(platform_records, manifest, "render")["status"] == "passed"
        )
        assert verify_records(spans, manifest, "logfire")["status"] == "passed"


class TestReaders:
    def test_render_pagination(self, mocker: MockerFixture, manifest: Manifest) -> None:
        client = mocker.Mock(spec=httpx.Client)
        client.request.side_effect = [
            httpx.Response(
                200,
                request=httpx.Request("GET", "https://api.render.com"),
                json={
                    "logs": [{"message": "first"}],
                    "hasMore": True,
                    "nextStartTime": "next-start",
                    "nextEndTime": "next-end",
                },
            ),
            httpx.Response(
                200,
                request=httpx.Request("GET", "https://api.render.com"),
                json={"logs": [{"message": "second"}], "hasMore": False},
            ),
        ]
        render = RenderClient(client, "credential", "owner")
        records = render.logs("srv-api", manifest.emitted_at, str(manifest.run_id))
        assert [record["message"] for record in records] == ["first", "second"]
        assert client.request.call_args.kwargs["params"]["startTime"] == "next-start"
        assert client.request.call_args.kwargs["params"]["endTime"] == "next-end"

    def test_s3_window_crosses_midnight(
        self, mocker: MockerFixture, manifest: Manifest
    ) -> None:
        emitted_at = datetime(2026, 1, 1, 0, 0, 10, tzinfo=UTC)
        manifest.emitted_at = emitted_at
        clock = mocker.patch("polar.pii_validation.readers.datetime", wraps=datetime)
        clock.now.return_value = emitted_at
        s3 = mocker.Mock()
        s3.list_objects_v2.return_value = {"Contents": [], "IsTruncated": False}
        mocker.patch("polar.pii_validation.readers.boto3.client", return_value=s3)
        assert S3Reader().read(manifest) == []
        assert [
            call.kwargs["StartAfter"] for call in s3.list_objects_v2.call_args_list
        ] == [
            "spans/api/dt=2025-12-31/hour=23/5940",
            "spans/api/dt=2026-01-01/hour=00/",
        ]

    def test_s3_reads_stored_gzip_and_reuses_cache(
        self,
        mocker: MockerFixture,
        manifest: Manifest,
        stored_records: list[dict[str, Any]],
    ) -> None:
        s3 = mocker.Mock()
        mocker.patch("polar.pii_validation.readers.boto3.client", return_value=s3)
        data = gzip.compress(
            "\n".join(json.dumps(row) for row in stored_records).encode()
        )
        s3.list_objects_v2.return_value = {
            "Contents": [
                {
                    "Key": "batch.jsonl.gz",
                    "Size": len(data),
                    "LastModified": manifest.emitted_at,
                }
            ],
            "IsTruncated": False,
        }
        s3.get_object.return_value = {"Body": BytesIO(data)}
        reader = S3Reader()
        assert reader.read(manifest) == stored_records
        assert reader.read(manifest) == stored_records
        s3.get_object.assert_called_once()
        s3.list_objects_v2.return_value = {"IsTruncated": True}
        with pytest.raises(RuntimeError, match="object limit"):
            reader.read(manifest)


class TestDeploymentValidation:
    def test_successful_round_trip_and_manifest_checks(
        self,
        manifest: Manifest,
        stored_records: list[dict[str, Any]],
        mocker: MockerFixture,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        for key in (
            "RENDER_API_TOKEN",
            "PII_VALIDATION_RENDER_OWNER_ID",
            "PII_VALIDATION_LOGFIRE_READ_TOKEN",
        ):
            monkeypatch.setenv(key, "configured")
        render = mocker.Mock(spec=RenderClient)
        render.create_job.return_value = "job-123"
        render.request.return_value = {"status": "succeeded"}
        render.logs.side_effect = lambda resource, start, text: (
            [{"message": MANIFEST_PREFIX + manifest.model_dump_json()}]
            if text == MANIFEST_PREFIX.strip()
            else stored_records
        )
        mocker.patch("scripts.validate_pii.RenderClient", return_value=render)
        mocker.patch("scripts.validate_pii.LogfireQueryClient")
        s3 = mocker.patch("scripts.validate_pii.S3Reader").return_value
        s3.read.return_value = stored_records
        mocker.patch(
            "scripts.validate_pii.logfire_records", return_value=stored_records
        )
        mocker.patch("scripts.validate_pii.time.sleep")
        mocker.patch("scripts.validate_pii.time.monotonic", side_effect=count(step=10))
        request = ValidationRequest(run_id=manifest.run_id, release=manifest.release)
        report: dict[str, Any] = {"destinations": {}}
        assert run(request, "testing", "srv-api", report, 900)
        assert set(report["destinations"]) == {"render", "logfire", "s3"}
        assert all(call.args[0] == "job-123" for call in render.logs.call_args_list)
        assert all(
            result["status"] == "passed" for result in report["destinations"].values()
        )
        manifest.logfire_enabled = False
        with pytest.raises(RuntimeError, match="required destinations"):
            run(request, "testing", "srv-api", report, 900)
        render.request.return_value = {"status": "pending"}
        with pytest.raises(TimeoutError):
            run(request, "testing", "srv-api", report, 30)


class TestReport:
    def test_error_boundary_never_copies_error_payload(
        self, tmp_path: Path, mocker: MockerFixture, capsys: pytest.CaptureFixture[str]
    ) -> None:
        output = tmp_path / "pii-validation.json"
        mocker.patch(
            "sys.argv",
            [
                "validate_pii",
                "--release",
                "a" * 40,
                "--environment",
                "sandbox",
                "--service-id",
                "srv-api",
                "--output",
                str(output),
            ],
        )
        mocker.patch(
            "scripts.validate_pii.run",
            side_effect=RuntimeError("credential-DO-NOT-COPY"),
        )
        with pytest.raises(SystemExit) as exit_info:
            main()
        assert exit_info.value.code == 1
        report = json.loads(output.read_text())
        assert report["status"] == "failed"
        assert report["error_type"] == "RuntimeError"
        assert "credential-DO-NOT-COPY" not in output.read_text()
        assert "credential-DO-NOT-COPY" not in output.with_suffix(".md").read_text()
        assert "credential-DO-NOT-COPY" not in capsys.readouterr().out
