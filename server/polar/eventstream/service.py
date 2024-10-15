from typing import Any
from uuid import UUID

import structlog
from pydantic import BaseModel

from polar.kit.utils import generate_uuid
from polar.logging import Logger
from polar.postgres import AsyncSession
from polar.redis import Redis, redis
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()


class Receivers(BaseModel):
    user_id: UUID | None = None
    organization_id: UUID | None = None
    checkout_client_secret: str | None = None

    def generate_channel_name(self, scope: str, resource_id: UUID | str) -> str:
        return f"{scope}:{resource_id}"

    def get_channels(self) -> list[str]:
        channels = []
        if self.user_id:
            channels.append(self.generate_channel_name("user", self.user_id))

        if self.organization_id:
            channels.append(self.generate_channel_name("org", self.organization_id))

        if self.checkout_client_secret:
            channels.append(
                self.generate_channel_name("checkout", self.checkout_client_secret)
            )

        return channels


class Event(BaseModel):
    id: UUID
    key: str
    payload: dict[str, Any]


async def send_event(redis: Redis, event_json: str, channels: list[str]) -> None:
    for channel in channels:
        await redis.publish(channel, event_json)
    log.debug(
        "Published event to eventstream", event_json=event_json, channels=channels
    )


async def publish(
    key: str,
    payload: dict[str, Any],
    user_id: UUID | None = None,
    organization_id: UUID | None = None,
    checkout_client_secret: str | None = None,
    *,
    run_in_worker: bool = True,
) -> None:
    receivers = Receivers(
        user_id=user_id,
        organization_id=organization_id,
        checkout_client_secret=checkout_client_secret,
    )
    channels = receivers.get_channels()
    event = Event(
        id=generate_uuid(),
        key=key,
        payload=payload,
    ).model_dump_json()

    if run_in_worker:
        enqueue_job("eventstream.publish", event, channels)
    else:
        await send_event(redis, event, channels)


async def publish_members(
    session: AsyncSession,
    key: str,
    payload: dict[str, Any],
    organization_id: UUID,
    *,
    run_in_worker: bool = True,
) -> None:
    members = await user_organization_service.list_by_org(
        session, org_id=organization_id
    )

    for m in members:
        receivers = Receivers(user_id=m.user_id)
        channels = receivers.get_channels()
        event = Event(
            id=generate_uuid(),
            key=key,
            payload=payload,
        ).model_dump_json()

        if run_in_worker:
            enqueue_job("eventstream.publish", event, channels)
        else:
            await send_event(redis, event, channels)
