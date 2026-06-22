import asyncio
import functools
import itertools
import json
from collections import defaultdict
from typing import TYPE_CHECKING, Any

import boto3
import structlog
from botocore.config import Config

from polar.config import settings
from polar.logging import Logger

from ._encoder import _json_obj_serializer

if TYPE_CHECKING:
    from mypy_boto3_sqs.client import SQSClient
    from mypy_boto3_sqs.type_defs import SendMessageBatchRequestEntryTypeDef

log: Logger = structlog.get_logger()

# SQS hard limits.
SQS_BATCH_SIZE = 10
MAX_DELAY_SECONDS = 900

type Job = tuple[str, tuple[Any, ...], dict[str, Any], int | None, str | None]


class SQSSendError(Exception):
    def __init__(self, queue_name: str, failed: list[Any]) -> None:
        self.queue_name = queue_name
        self.failed = failed
        super().__init__(f"Failed to send {len(failed)} message(s) to {queue_name}")


@functools.lru_cache(maxsize=1)
def get_sqs_client() -> "SQSClient":
    return boto3.client(
        "sqs",
        endpoint_url=settings.SQS_ENDPOINT_URL,
        aws_access_key_id=(
            settings.WORKER_SQS_AWS_ACCESS_KEY_ID or settings.AWS_ACCESS_KEY_ID
        ),
        aws_secret_access_key=(
            settings.WORKER_SQS_AWS_SECRET_ACCESS_KEY or settings.AWS_SECRET_ACCESS_KEY
        ),
        config=Config(
            region_name=settings.AWS_REGION,
            signature_version=settings.AWS_SIGNATURE_VERSION,
            connect_timeout=2,
            read_timeout=5,
            retries={"max_attempts": 2, "mode": "standard"},
        ),
    )


def actor_to_queue_name(actor_name: str) -> str:
    sanitized = actor_name.replace(".", "-").replace("_", "-")
    return f"{settings.WORKER_SQS_QUEUE_PREFIX}-{sanitized}"


_queue_url_cache: dict[str, str] = {}


def get_queue_url(client: "SQSClient", queue_name: str) -> str:
    url = _queue_url_cache.get(queue_name)
    if url is None:
        url = client.get_queue_url(QueueName=queue_name)["QueueUrl"]
        _queue_url_cache[queue_name] = url
    return url


def build_envelope(
    actor: str,
    args: tuple[Any, ...],
    kwargs: dict[str, Any],
    correlation_id: str | None,
) -> str:
    return json.dumps(
        {
            "actor": actor,
            "args": args,
            "kwargs": kwargs,
            "correlation_id": correlation_id,
        },
        separators=(",", ":"),
        default=_json_obj_serializer,
    )


def parse_envelope(body: str) -> tuple[str, list[Any], dict[str, Any], str | None]:
    data = json.loads(body)
    return (
        data["actor"],
        data.get("args", []),
        data.get("kwargs", {}),
        data.get("correlation_id"),
    )


async def send_jobs(jobs: list[Job]) -> None:
    if not jobs:
        return
    await asyncio.to_thread(_send_jobs_sync, jobs)


def _send_jobs_sync(jobs: list[Job]) -> None:
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
    "Job",
    "SQSSendError",
    "actor_to_queue_name",
    "build_envelope",
    "get_queue_url",
    "get_sqs_client",
    "parse_envelope",
    "send_jobs",
]
