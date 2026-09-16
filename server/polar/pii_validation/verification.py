import json
from typing import Any, Literal

from polar.pii_validation.cases import (
    PLATFORM_CASES,
    SPAN_CASES,
    customer_id,
    marker,
    sensitive_fields,
    sensitive_text,
)
from polar.pii_validation.schemas import Manifest

Destination = Literal["render", "logfire", "s3", "sentry"]
DESTINATIONS: tuple[Destination, ...] = ("render", "logfire", "s3", "sentry")


def verify_records(
    records: list[dict[str, Any]], manifest: Manifest, destination: Destination
) -> dict[str, Any]:
    serialized = [json.dumps(record, ensure_ascii=False) for record in records]
    samples = sensitive_fields(manifest.run_id) | sensitive_text(manifest.run_id)
    samples["bearer"] = samples["bearer"].removeprefix("Bearer ")
    leaked_fields = sorted(
        key for key, value in samples.items() if any(value in row for row in serialized)
    )
    cases = (
        ("exception", "breadcrumb")
        if destination == "sentry"
        else PLATFORM_CASES
        if destination == "render"
        else SPAN_CASES
    )
    missing_cases = []
    invalid_cases = []
    for case in cases:
        matches = [row for row in serialized if marker(manifest.run_id, case) in row]
        if not matches:
            missing_cases.append(case)
        elif any(
            "[Redacted]" not in row
            or customer_id(manifest.run_id) not in row
            or (case == "exception" and "ValueError" not in row)
            for row in matches
        ):
            invalid_cases.append(case)
    return {
        "status": "failed"
        if leaked_fields or invalid_cases
        else "pending"
        if missing_cases
        else "passed",
        "records_checked": len(records),
        "leaked_fields": leaked_fields,
        "missing_cases": missing_cases,
        "invalid_cases": invalid_cases,
    }
