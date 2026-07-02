import asyncio
from typing import Any

import logfire
import structlog

from polar.config import settings
from polar.logfire import configure_logfire
from polar.logging import Logger
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry

from ._runner import RetryAction, bootstrap, plan_retry, run_task
from ._sqs import (
    build_envelope,
    build_retry_schedule_name,
    get_consumer_scheduler_client,
    get_consumer_sqs_client,
    parse_envelope,
    schedule_delayed_message,
    send_to_dlq,
    set_message_visibility,
)

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

consumer_sqs_client = get_consumer_sqs_client()
consumer_scheduler_client = get_consumer_scheduler_client()


def handler(event: dict[str, Any], context: Any) -> dict[str, Any]:
    batch_item_failures: list[dict[str, str]] = []
    try:
        for record in event.get("Records", []):
            message_id = record["messageId"]
            try:
                actor, args, kwargs, correlation_id, attempt = parse_envelope(
                    record["body"]
                )
                _loop.run_until_complete(
                    run_task(
                        actor,
                        args,
                        kwargs,
                        receive_count=_effective_receive_count(record, attempt),
                        source_correlation_id=correlation_id,
                    )
                )
            except Exception as exc:
                log.error(
                    "polar.worker.sqs_task_failed",
                    message_id=message_id,
                    exc_info=True,
                )
                if _apply_retry_backoff(record, exc):
                    batch_item_failures.append({"itemIdentifier": message_id})
    finally:
        logfire.force_flush()
    return {"batchItemFailures": batch_item_failures}


def _effective_receive_count(record: dict[str, Any], attempt: int) -> int:
    """Total attempts, combining the envelope's carried count with SQS redeliveries."""
    sqs_receive_count = int(
        record.get("attributes", {}).get("ApproximateReceiveCount", "1")
    )
    return attempt + (sqs_receive_count - 1)


def _apply_retry_backoff(record: dict[str, Any], exception: BaseException) -> bool:
    """Schedule the failed message's next retry. Returns True if SQS should redeliver it."""
    try:
        actor, args, kwargs, correlation_id, attempt = parse_envelope(record["body"])
        queue_arn = record["eventSourceARN"]
        receive_count = _effective_receive_count(record, attempt)
        scheduler_role_arn = settings.WORKER_SQS_SCHEDULER_ROLE_ARN

        action, delay_seconds = plan_retry(
            actor,
            receive_count,
            exception,
            scheduler_available=scheduler_role_arn is not None,
        )

        if action is RetryAction.DEAD_LETTER:
            send_to_dlq(consumer_sqs_client, queue_arn, record["body"])
            log.info(
                "polar.worker.sqs_retry_exhausted",
                actor=actor,
                receive_count=receive_count,
            )
            return False

        if action is RetryAction.SCHEDULE:
            assert scheduler_role_arn is not None
            schedule_delayed_message(
                consumer_scheduler_client,
                queue_arn,
                scheduler_role_arn,
                build_envelope(
                    actor, tuple(args), kwargs, correlation_id, receive_count + 1
                ),
                delay_seconds,
                build_retry_schedule_name(queue_arn, record["messageId"], attempt),
            )
            log.info(
                "polar.worker.sqs_retry_scheduled_eventbridge",
                actor=actor,
                receive_count=receive_count,
                backoff_seconds=delay_seconds,
            )
            return False

        set_message_visibility(
            consumer_sqs_client,
            queue_arn,
            record["receiptHandle"],
            delay_seconds,
        )
        log.info(
            "polar.worker.sqs_retry_scheduled",
            actor=actor,
            receive_count=receive_count,
            backoff_seconds=delay_seconds,
        )
        return True
    except Exception:
        log.error("polar.worker.sqs_backoff_failed", exc_info=True)
        return True
