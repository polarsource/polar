import asyncio
from typing import Any

import logfire
import structlog

from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry

from ._runner import bootstrap, compute_retry_backoff, run_task
from ._sqs import parse_envelope, set_message_visibility

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

log: Logger = structlog.get_logger()

# One persistent event loop for the container's lifetime: the SQLAlchemy/asyncpg
# pool binds connections to the loop that first uses them, so every invocation
# must run on the same loop (a fresh asyncio.run() per record would break it).
_loop = asyncio.new_event_loop()
asyncio.set_event_loop(_loop)
bootstrap()


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    batch_item_failures: list[dict[str, str]] = []
    try:
        for record in event.get("Records", []):
            message_id = record["messageId"]
            try:
                actor, args, kwargs, correlation_id = parse_envelope(record["body"])
                receive_count = int(
                    record.get("attributes", {}).get("ApproximateReceiveCount", "1")
                )
                _loop.run_until_complete(
                    run_task(
                        actor,
                        args,
                        kwargs,
                        receive_count=receive_count,
                        source_correlation_id=correlation_id,
                    )
                )
            except Exception:
                log.error(
                    "polar.worker.sqs_task_failed",
                    message_id=message_id,
                    exc_info=True,
                )
                _apply_retry_backoff(record)
                batch_item_failures.append({"itemIdentifier": message_id})
    finally:
        logfire.force_flush()
    return {"batchItemFailures": batch_item_failures}


def _apply_retry_backoff(record: dict[str, Any]) -> None:
    """Delay the failed message's next SQS redelivery by the Dramatiq-style backoff."""
    try:
        actor, _, _, _ = parse_envelope(record["body"])
        receive_count = int(
            record.get("attributes", {}).get("ApproximateReceiveCount", "1")
        )
        backoff_seconds = compute_retry_backoff(actor, receive_count)
        set_message_visibility(
            record["eventSourceARN"], record["receiptHandle"], backoff_seconds
        )
        log.info(
            "polar.worker.sqs_retry_scheduled",
            actor=actor,
            receive_count=receive_count,
            backoff_seconds=backoff_seconds,
        )
    except Exception:
        log.error("polar.worker.sqs_backoff_failed", exc_info=True)
