import uuid
from dataclasses import dataclass, field
from datetime import date
from zoneinfo import ZoneInfo

from polar.auth.models import AuthSubject, Organization, User
from polar.postgres import AsyncReadSession
from polar.redis import Redis

from .blocks import AssistantBlock


@dataclass
class AssistantDeps:
    """Everything a tool call runs against.

    The auth subject is the *caller's* — the assistant is a conduit for the
    caller's own permissions, never an escalator. Tools derive the organization
    from here (validated against the subject's accessible organizations before
    the run starts) and must never accept an organization from model arguments.
    """

    session: AsyncReadSession
    auth_subject: AuthSubject[User | Organization]
    organization_id: uuid.UUID
    timezone: ZoneInfo
    today: date
    redis: Redis | None = None
    blocks: list[AssistantBlock] = field(default_factory=list)
    """Renderable blocks produced by tools during the run, in order. The
    endpoint streams them to the client interleaved with the model's text."""

    def emit(self, block: AssistantBlock) -> int:
        """Queue a block for rendering; returns its placement marker index.

        Blocks are not shown until the model places them in its answer with a
        `[block:N]` marker (see `stream.py`), so UI lands under the claim it
        supports. Unplaced blocks are appended at the end as a fallback."""
        self.blocks.append(block)
        return len(self.blocks)
