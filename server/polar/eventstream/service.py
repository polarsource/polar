from typing import Any
from uuid import UUID

from pydantic import BaseModel

from polar.kit.utils import generate_uuid
from polar.postgres import AsyncSession
from polar.redis import redis
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


class Receivers(BaseModel):
    user_id: UUID | None = None
    organization_id: UUID | None = None
    repository_id: UUID | None = None

    def generate_channel_name(self, scope: str, resource_id: UUID) -> str:
        return f"{scope}:{resource_id}"

    def get_channels(self) -> list[str]:
        channels = []
        if self.user_id:
            channels.append(self.generate_channel_name("user", self.user_id))

        if self.organization_id:
            channels.append(self.generate_channel_name("org", self.organization_id))

        if self.repository_id:
            channels.append(self.generate_channel_name("repo", self.repository_id))

        return channels


class Event(BaseModel):
    id: UUID
    key: str
    payload: dict[str, Any]


async def send(event: Event, channels: list[str]) -> None:
    event_json = event.model_dump_json()
    for channel in channels:
        await redis.publish(channel, event_json)


async def publish(
    key: str,
    payload: dict[str, Any],
    user_id: UUID | None = None,
    organization_id: UUID | None = None,
    repository_id: UUID | None = None,
) -> None:
    receivers = Receivers(
        user_id=user_id, organization_id=organization_id, repository_id=repository_id
    )
    channels = receivers.get_channels()
    event = Event(
        id=generate_uuid(),
        key=key,
        payload=payload,
    )
    await send(event, channels)


async def publish_members(
    session: AsyncSession,
    key: str,
    payload: dict[str, Any],
    organization_id: UUID,
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
        )
        await send(event, channels)
