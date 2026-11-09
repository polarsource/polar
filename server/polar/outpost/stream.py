import collections.abc
import datetime
import functools
import json
import typing
import uuid

import anyio
from pydantic import GetCoreSchemaHandler, TypeAdapter
from pydantic_core import CoreSchema, core_schema

from polar.kit.json import json_obj_serializer
from polar.redis import Redis
from polar.worker import JobQueueManager


class ReducerBucketOutpostEvent(typing.TypedDict):
    type: typing.Literal["reducer_bucket"]
    reducer_id: uuid.UUID
    customer_id: uuid.UUID | None
    external_customer_id: str | None


class ConfigurationOutpostEvent(typing.TypedDict):
    type: typing.Literal["configuration"]


type OutpostEvent = ReducerBucketOutpostEvent | ConfigurationOutpostEvent

MAX_SEQUENCE = 2**64 - 1


@functools.total_ordering
class Cursor:
    """A stream entry id: milliseconds and a sequence within them."""

    __slots__ = ("milliseconds", "sequence")

    def __init__(self, milliseconds: int, sequence: int) -> None:
        self.milliseconds = milliseconds
        self.sequence = sequence

    @classmethod
    def parse(cls, value: str | bytes) -> typing.Self:
        milliseconds, sequence = (
            value.decode() if isinstance(value, bytes) else value
        ).split("-")
        return cls(int(milliseconds), int(sequence))

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source: typing.Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        return core_schema.no_info_after_validator_function(
            cls._validate,
            core_schema.str_schema(pattern=r"^\d+-\d+$"),
            serialization=core_schema.to_string_ser_schema(),
        )

    @classmethod
    def _validate(cls, value: str) -> typing.Self:
        cursor = cls.parse(value)
        if max(cursor.milliseconds, cursor.sequence) > MAX_SEQUENCE:
            raise ValueError("A stream id holds two 64-bit numbers.")
        return cursor

    def __str__(self) -> str:
        return f"{self.milliseconds}-{self.sequence}"

    def __eq__(self, other: object) -> bool:
        return isinstance(other, Cursor) and self._key() == other._key()

    def __lt__(self, other: "Cursor") -> bool:
        return self._key() < other._key()

    def _key(self) -> tuple[int, int]:
        return self.milliseconds, self.sequence


# A cursor older than this has missed changes: the client starts over.
CHANGES_RETENTION = datetime.timedelta(hours=1)


def _get_channel(organization_id: uuid.UUID) -> str:
    return f"outpost:{organization_id}"


def get_changes_key(organization_id: uuid.UUID) -> str:
    return f"outpost:changes:{organization_id}"


def _encode(event: OutpostEvent) -> str:
    return json.dumps(event, default=json_obj_serializer)


_events: TypeAdapter[OutpostEvent] = TypeAdapter(OutpostEvent)


def _decode(data: str | bytes) -> OutpostEvent:
    return _events.validate_json(data)


async def publish(
    redis: Redis,
    organization_id: uuid.UUID,
    event: OutpostEvent,
) -> None:
    await redis.publish(_get_channel(organization_id), _encode(event))


async def read_changes(
    redis: Redis, organization_id: uuid.UUID, after: Cursor | None, limit: int
) -> tuple[list[tuple[Cursor, OutpostEvent]], int]:
    """The changes after the cursor, and Redis' time in milliseconds when it read
    them: any later entry gets a later id."""
    async with redis.pipeline(transaction=True) as pipeline:
        if after is not None:
            pipeline.xrange(
                get_changes_key(organization_id),
                # "(" makes the bound exclusive: the entry at the cursor was read.
                min=f"({after}",
                count=limit,
            )
        pipeline.time()
        *entries, (seconds, microseconds) = await pipeline.execute()
    # Each entry holds one field: the event.
    changes = [
        (Cursor.parse(entry_id), _decode(next(iter(fields.values()))))
        for entry_id, fields in (entries[0] if entries else [])
    ]
    return changes, int(seconds) * 1000 + int(microseconds) // 1000


def enqueue(organization_id: uuid.UUID, event: OutpostEvent) -> None:
    """Publish the event and append it to the organization's changes once the
    transaction committed."""
    job_queue_manager = JobQueueManager.get()
    job_queue_manager.publish(_get_channel(organization_id), _encode(event))
    job_queue_manager.append(
        get_changes_key(organization_id),
        {"event": _encode(event)},
        retention=CHANGES_RETENTION,
    )


async def subscribe(
    redis: Redis,
    organization_id: uuid.UUID,
) -> collections.abc.AsyncGenerator[OutpostEvent]:
    pubsub = redis.pubsub()
    try:
        await pubsub.subscribe(_get_channel(organization_id))
        while True:
            message = await pubsub.get_message(
                ignore_subscribe_messages=True, timeout=1.0
            )
            if message is not None:
                yield _decode(message["data"])
    finally:
        with anyio.CancelScope(shield=True):
            await pubsub.close()
