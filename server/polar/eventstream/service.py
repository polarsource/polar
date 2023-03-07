import uuid
from typing import Any

from pydantic import BaseModel

from polar.redis import redis


class Receivers(BaseModel):
    user_id: str | None = None
    organization_id: str | None = None
    repository_id: str | None = None

    def generate_channel_name(self, scope: str, resource_id: str) -> str:
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
    id: uuid.UUID
    key: str
    payload: dict[str, Any]


async def send(event: Event, channels: list[str]) -> None:
    event_json = event.json()
    for channel in channels:
        await redis.publish(channel, event_json)


async def publish(
    key: str,
    payload: dict[str, Any],
    user_id: str | None = None,
    organization_id: str | None = None,
    repository_id: str | None = None,
) -> None:
    receivers = Receivers(
        user_id=user_id, organization_id=organization_id, repository_id=repository_id
    )
    channels = receivers.get_channels()
    event = Event(
        id=uuid.uuid4(),
        key=key,
        payload=payload,
    )
    await send(event, channels)
