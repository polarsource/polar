import asyncio
import hashlib
import itertools
import json
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from typing import TYPE_CHECKING, Any

import boto3
import structlog
from botocore.config import Config
from botocore.exceptions import ClientError

from polar.config import settings
from polar.kit.json import json_obj_serializer
from polar.logging import Logger

if TYPE_CHECKING:
    from mypy_boto3_scheduler.client import EventBridgeSchedulerClient
    from mypy_boto3_sqs.client import SQSClient
    from mypy_boto3_sqs.type_defs import SendMessageBatchRequestEntryTypeDef

log: Logger = structlog.get_logger()

# SQS hard limits.
SQS_BATCH_SIZE = 10
MAX_DELAY_SECONDS = 900
MAX_VISIBILITY_TIMEOUT_SECONDS = 43_200

type Job = tuple[str, tuple[Any, ...], dict[str, Any], int | None, str | None]


class SQSSendError(Exception):
    def __init__(self, queue_name: str, failed: list[Any]) -> None:
        self.queue_name = queue_name
        self.failed = failed
        super().__init__(f"Failed to send {len(failed)} message(s) to {queue_name}")


def get_sqs_client() -> "SQSClient":
    access_key_id = settings.WORKER_SQS_AWS_ACCESS_KEY_ID
    secret_access_key = settings.WORKER_SQS_AWS_SECRET_ACCESS_KEY
    if access_key_id is None and (
        settings.SQS_ENDPOINT_URL is not None
        or settings.is_development()
        or settings.is_testing()
    ):
        access_key_id = settings.AWS_ACCESS_KEY_ID
        secret_access_key = settings.AWS_SECRET_ACCESS_KEY
    # None credentials: boto3's default chain assumes the Render OIDC role (AWS_ROLE_ARN).
    return boto3.client(
        "sqs",
        endpoint_url=settings.SQS_ENDPOINT_URL,
        aws_access_key_id=access_key_id,
        aws_secret_access_key=secret_access_key,
        config=Config(
            region_name=settings.AWS_REGION,
            signature_version=settings.AWS_SIGNATURE_VERSION,
            connect_timeout=2,
            read_timeout=5,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def get_consumer_sqs_client() -> "SQSClient":
    """SQS client authenticated by the Lambda execution role (no static keys)."""
    return boto3.client(
        "sqs",
        endpoint_url=settings.SQS_ENDPOINT_URL,
        config=Config(
            region_name=settings.AWS_REGION,
            signature_version=settings.AWS_SIGNATURE_VERSION,
            connect_timeout=2,
            read_timeout=5,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def get_consumer_scheduler_client() -> "EventBridgeSchedulerClient":
    """EventBridge Scheduler client authenticated by the Lambda execution role."""
    return boto3.client(
        "scheduler",
        config=Config(
            region_name=settings.AWS_REGION,
            signature_version=settings.AWS_SIGNATURE_VERSION,
            connect_timeout=2,
            read_timeout=5,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


sqs_client = get_sqs_client()


def actor_to_queue_name(_actor_name: str) -> str:
    return f"{settings.WORKER_SQS_QUEUE_PREFIX}-default"


_queue_url_cache: dict[tuple[int, str], str] = {}


def get_queue_url(client: "SQSClient", queue_name: str) -> str:
    cache_key = (id(client), queue_name)
    url = _queue_url_cache.get(cache_key)
    if url is None:
        url = client.get_queue_url(QueueName=queue_name)["QueueUrl"]
        _queue_url_cache[cache_key] = url
    return url


def build_envelope(
    actor: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    correlation_id: str | None,
    attempt: int = 1,
) -> str:
    return json.dumps(
        {
            "actor": actor,
            "args": args,
            "kwargs": kwargs,
            "correlation_id": correlation_id,
            "attempt": attempt,
        },
        separators=(",", ":"),
        default=json_obj_serializer,
    )


def parse_envelope(
    body: str,
) -> tuple[str, list[Any], dict[str, Any], str | None, int]:
    data = json.loads(body)
    return (
        data["actor"],
        data.get("args", []),
        data.get("kwargs", {}),
        data.get("correlation_id"),
        data.get("attempt", 1),
    )


def set_message_visibility(
    client: "SQSClient",
    queue_arn: str,
    receipt_handle: str,
    timeout_seconds: int,
) -> None:
    queue_name = queue_arn.rsplit(":", 1)[-1]
    queue_url = get_queue_url(client, queue_name)
    client.change_message_visibility(
        QueueUrl=queue_url,
        ReceiptHandle=receipt_handle,
        VisibilityTimeout=timeout_seconds,
    )


def build_retry_schedule_name(queue_arn: str, message_id: str, attempt: int) -> str:
    """Deterministic per logical handoff so a crash + SQS redelivery is idempotent."""
    digest = hashlib.sha256(f"{queue_arn}:{message_id}:{attempt}".encode()).hexdigest()
    return f"polar-retry-{digest[:40]}"


def schedule_delayed_message(
    client: "EventBridgeSchedulerClient",
    queue_arn: str,
    role_arn: str,
    body: str,
    delay_seconds: int,
    schedule_name: str,
) -> None:
    """Redeliver to SQS after a delay longer than SQS visibility allows (>12h)."""
    fire_at = datetime.now(UTC) + timedelta(seconds=delay_seconds)
    try:
        client.create_schedule(
            Name=schedule_name,
            ScheduleExpression=f"at({fire_at:%Y-%m-%dT%H:%M:%S})",
            ScheduleExpressionTimezone="UTC",
            FlexibleTimeWindow={"Mode": "OFF"},
            Target={"Arn": queue_arn, "RoleArn": role_arn, "Input": body},
            ActionAfterCompletion="DELETE",
            State="ENABLED",
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code")
        if code in {"ConflictException", "ResourceAlreadyExistsException"}:
            return
        raise


def send_to_dlq(client: "SQSClient", queue_arn: str, body: str) -> None:
    queue_name = queue_arn.rsplit(":", 1)[-1]
    dlq_url = get_queue_url(client, f"{queue_name}-dlq")
    client.send_message(QueueUrl=dlq_url, MessageBody=body)


async def send_jobs(jobs: list[Job]) -> None:
    if not jobs:
        return
    await asyncio.to_thread(send_jobs_sync, jobs)


def send_jobs_sync(jobs: list[Job]) -> None:
    if not jobs:
        return
    client = get_sqs_client()

    by_queue: dict[str, list[SendMessageBatchRequestEntryTypeDef]] = defaultdict(list)
    for actor, args, kwargs, delay, correlation_id in jobs:
        entries = by_queue[actor_to_queue_name(actor)]
        entry: SendMessageBatchRequestEntryTypeDef = {
            "Id": str(len(entries)),
            "MessageBody": build_envelope(actor, args, kwargs, correlation_id),
        }
        if delay:
            entry["DelaySeconds"] = min(round(delay / 1000), MAX_DELAY_SECONDS)
        entries.append(entry)

    for queue_name, entries in by_queue.items():
        queue_url = get_queue_url(client, queue_name)
        for batch in itertools.batched(entries, SQS_BATCH_SIZE):
            response = client.send_message_batch(
                QueueUrl=queue_url, Entries=list(batch)
            )
            failed = response.get("Failed", [])
            if failed:
                log.error(
                    "polar.worker.sqs_send_failed", queue=queue_name, failed=failed
                )
                raise SQSSendError(queue_name, list(failed))
            log.debug("polar.worker.sqs_jobs_sent", queue=queue_name, count=len(batch))


__all__ = [
    "MAX_VISIBILITY_TIMEOUT_SECONDS",
    "Job",
    "SQSSendError",
    "actor_to_queue_name",
    "build_envelope",
    "build_retry_schedule_name",
    "get_consumer_scheduler_client",
    "get_consumer_sqs_client",
    "get_queue_url",
    "get_sqs_client",
    "parse_envelope",
    "schedule_delayed_message",
    "send_jobs",
    "send_jobs_sync",
    "send_to_dlq",
    "set_message_visibility",
    "sqs_client",
]
