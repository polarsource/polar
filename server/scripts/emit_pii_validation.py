import argparse
import logging
import os
from datetime import UTC, datetime
from uuid import UUID

import logfire
import sentry_sdk
import structlog

from polar.config import settings
from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.pii_validation.cases import (
    MANIFEST_PREFIX,
    customer_id,
    marker,
    sensitive_fields,
    sensitive_text,
)
from polar.pii_validation.schemas import Manifest, ValidationRequest
from polar.sentry import configure_sentry


def emit(request: ValidationRequest) -> Manifest:
    if os.environ["RELEASE_VERSION"] != request.release:
        raise RuntimeError("One-off job release mismatch")
    configure_sentry()
    configure_logfire("server")
    configure_logging(logfire=True)
    log: Logger = structlog.get_logger()
    emitted_at = datetime.now(UTC)
    fields = sensitive_fields(request.run_id)
    text = " | ".join(sensitive_text(request.run_id).values())
    safe_customer_id = customer_id(request.run_id)

    with structlog.contextvars.bound_contextvars(customer_id=safe_customer_id):
        log.warning(marker(request.run_id, "structured"), **fields)
        logging.getLogger("polar.pii_validation").warning(
            "%s %s", marker(request.run_id, "stdlib"), text
        )
        with sentry_sdk.new_scope() as scope:
            scope.fingerprint = ["pii-validation"]
            scope.set_tag("pii_validation_run_id", str(request.run_id))
            scope.set_user({"id": safe_customer_id, "email": fields["email"]})
            scope.set_context("pii_validation", fields)
            scope.add_breadcrumb(
                message=marker(request.run_id, "breadcrumb"), data=fields
            )
            try:
                raise ValueError(f"{marker(request.run_id, 'exception')} {text}")
            except ValueError as error:
                log.exception(marker(request.run_id, "exception"))
                sentry_event_id = sentry_sdk.capture_exception(error)
        logfire.log(
            "warn",
            marker(request.run_id, "logfire"),
            attributes={"customer_id": safe_customer_id, **fields},
        )

    if not logfire.force_flush(timeout_millis=30_000):
        raise RuntimeError("Logfire/S3 flush did not complete")
    sentry_sdk.flush(timeout=30)
    return Manifest(
        run_id=request.run_id,
        release=request.release,
        environment=settings.ENV.value,
        emitted_at=emitted_at,
        service_name=os.environ.get(
            "SERVICE_NAME", os.environ.get("RENDER_SERVICE_NAME", "server")
        ),
        logfire_enabled=bool(settings.LOGFIRE_TOKEN),
        s3_bucket=settings.S3_LOGS_BUCKET_NAME,
        sentry_event_id=sentry_event_id,
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--run-id", required=True, type=UUID)
    parser.add_argument("--release", required=True)
    args = parser.parse_args()
    try:
        manifest = emit(ValidationRequest(run_id=args.run_id, release=args.release))
    except Exception as error:
        # This CLI boundary must not print sensitive payloads or credentials.
        print(f"PII validation emission failed: {type(error).__name__}")
        raise SystemExit(1) from None
    print(MANIFEST_PREFIX + manifest.model_dump_json(), flush=True)


if __name__ == "__main__":
    main()
