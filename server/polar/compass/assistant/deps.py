import uuid
from dataclasses import dataclass, field
from datetime import date, datetime
from zoneinfo import ZoneInfo

from polar.auth.models import AuthSubject, Organization, User
from polar.postgres import AsyncReadSession
from polar.redis import Redis

from .blocks import AssistantBlock


@dataclass
class AssistantDeps:
    """Deps for a tool call. Organization comes from here, never from model args."""

    session: AsyncReadSession
    auth_subject: AuthSubject[User | Organization]
    organization_id: uuid.UUID
    timezone: ZoneInfo
    today: date
    redis: Redis | None = None
    history_last_at: datetime | None = None
    blocks: list[AssistantBlock] = field(default_factory=list)

    def emit(self, block: AssistantBlock) -> int:
        self.blocks.append(block)
        return len(self.blocks)
