import argparse
import json
import os
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any
from uuid import uuid4

import httpx
from logfire.query_client import LogfireQueryClient

from polar.pii_validation.cases import MANIFEST_PREFIX
from polar.pii_validation.readers import (
    RenderClient,
    S3Reader,
    logfire_records,
    sentry_records,
)
from polar.pii_validation.schemas import Manifest, ValidationRequest
from polar.pii_validation.verification import DESTINATIONS, verify_records


def run(
    request: ValidationRequest,
    environment: str,
    service_id: str,
    report: dict[str, Any],
    timeout: float,
) -> bool:
    started_at = datetime.now(UTC)
    deadline = time.monotonic() + timeout
    render_token = os.environ["RENDER_API_TOKEN"]
    render_owner = os.environ["PII_VALIDATION_RENDER_OWNER_ID"]
    logfire_token = os.environ["PII_VALIDATION_LOGFIRE_READ_TOKEN"]
    sentry_token = os.environ["PII_VALIDATION_SENTRY_READ_TOKEN"]
    sentry_org = os.environ["SENTRY_ORG"]
    sentry_project = os.environ["PII_VALIDATION_SENTRY_PROJECT"]
    if not all(
        (
            render_token,
            render_owner,
            logfire_token,
            sentry_token,
            sentry_org,
            sentry_project,
        )
    ):
        raise RuntimeError("Missing validation credentials")
    with (
        httpx.Client(timeout=30) as client,
        LogfireQueryClient(logfire_token, timeout=httpx.Timeout(30)) as logfire,
    ):
        render = RenderClient(client, render_token, render_owner)
        s3 = S3Reader()
        report["stage"] = "emission"
        job_id = render.create_job(service_id, request)
        report["render_job_id"] = job_id
        manifest = None
        while time.monotonic() < deadline:
            job = render.request("GET", f"/services/{service_id}/jobs/{job_id}")
            if job["status"] in {"failed", "canceled"}:
                raise RuntimeError("Render emission job failed")
            if job["status"] == "succeeded":
                logs = render.logs(job_id, started_at, MANIFEST_PREFIX.strip())
                manifests = [
                    row["message"].removeprefix(MANIFEST_PREFIX)
                    for row in logs
                    if row["message"].startswith(MANIFEST_PREFIX)
                ]
                if len(manifests) > 1:
                    raise RuntimeError("Multiple emission manifests")
                if manifests:
                    manifest = Manifest.model_validate_json(manifests[0])
                    break
            elif job["status"] not in {"pending", "running"}:
                raise RuntimeError("Unexpected Render job status")
            time.sleep(10)
        if manifest is None:
            raise TimeoutError("Emission manifest did not arrive")
        if (
            manifest.run_id != request.run_id
            or manifest.release != request.release
            or manifest.environment != environment
            or not started_at - timedelta(seconds=30)
            <= manifest.emitted_at
            <= datetime.now(UTC) + timedelta(seconds=30)
            or not manifest.logfire_enabled
            or not manifest.s3_bucket
            or not manifest.sentry_event_id
        ):
            raise RuntimeError(
                "Emission manifest does not match the deployment or required destinations"
            )
        report["stage"] = "stored-output"
        # Keep polling after the first complete sample to catch delayed duplicate records.
        complete_at: float | None = None
        while time.monotonic() < deadline:
            complete = True
            for destination in DESTINATIONS:
                report["checking"] = destination
                match destination:
                    case "render":
                        records = render.logs(
                            job_id,
                            manifest.emitted_at - timedelta(seconds=30),
                            str(request.run_id),
                        )
                    case "logfire":
                        records = logfire_records(logfire, manifest)
                    case "s3":
                        records = s3.read(manifest)
                    case "sentry":
                        records = sentry_records(
                            client, sentry_token, sentry_org, sentry_project, manifest
                        )
                result = verify_records(records, manifest, destination)
                report["destinations"][destination] = result
                if result["status"] == "failed":
                    return False
                complete = complete and result["status"] == "passed"
            if complete:
                complete_at = complete_at or time.monotonic()
                if time.monotonic() - complete_at >= 30:
                    report.pop("checking", None)
                    return True
            else:
                complete_at = None
            time.sleep(10)
        raise TimeoutError("Stored canary records did not arrive")


def write_report(report: dict[str, Any], output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report, indent=2) + "\n")
    lines = [
        "## PII validation",
        f"- Result: **{report['status']}**",
        f"- Environment: `{report['environment']}`",
        f"- Release: `{report['release']}`",
        f"- Run: `{report['run_id']}`",
        f"- Stage: `{report['stage']}`",
        "",
        "| Destination | Status | Records |",
        "| --- | --- | --- |",
    ]
    for destination, result in report["destinations"].items():
        lines.append(
            f"| {destination} | {result['status']} | {result['records_checked']} |"
        )
    if "error_type" in report:
        lines.append(
            f"\nValidation stopped: `{report['error_type']}`. See the JSON report for the failing stage."
        )
    summary = "\n".join(lines) + "\n"
    output.with_suffix(".md").write_text(summary)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--release", required=True)
    parser.add_argument(
        "--environment", required=True, choices=["sandbox", "production", "test"]
    )
    parser.add_argument("--service-id", required=True)
    parser.add_argument("--output", type=Path, default=Path("pii-validation.json"))
    parser.add_argument("--timeout", type=float, default=900)
    args = parser.parse_args()
    report: dict[str, Any] = {
        "schema_version": 1,
        "run_id": str(uuid4()),
        "release": args.release,
        "environment": args.environment,
        "started_at": datetime.now(UTC).isoformat(),
        "status": "incomplete",
        "stage": "configuration",
        "destinations": {},
    }
    write_report(report, args.output)
    try:
        request = ValidationRequest(run_id=report["run_id"], release=args.release)
        if run(
            request,
            args.environment,
            args.service_id,
            report,
            args.timeout,
        ):
            report["status"] = "passed"
        else:
            report["status"] = "failed"
    except Exception as error:
        # Stored payloads and HTTP errors must never be copied into CI logs or artifacts.
        report["status"] = "failed"
        report["error_type"] = type(error).__name__
        if isinstance(error, httpx.HTTPStatusError):
            report["http_status"] = error.response.status_code
    finally:
        report["finished_at"] = datetime.now(UTC).isoformat()
        write_report(report, args.output)
    print(f"PII validation: {report['status']} (report: {args.output})")
    raise SystemExit(0 if report["status"] == "passed" else 1)


if __name__ == "__main__":
    main()
