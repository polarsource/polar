from __future__ import annotations

import contextvars
import typing
from dataclasses import dataclass
from uuid import UUID

from polar.audit.enums import AuditActorType


@dataclass(frozen=True)
class AuditInfo:
    actor_type: AuditActorType
    actor_id: UUID | None
    actor_name: str | None
    ip_address: str | None


class AuditContext:
    _ctx: typing.ClassVar[contextvars.ContextVar[AuditInfo | None]] = (
        contextvars.ContextVar("polar.audit_context", default=None)
    )

    @classmethod
    def set(
        cls,
        *,
        actor_type: AuditActorType,
        actor_id: UUID | None = None,
        actor_name: str | None = None,
        ip_address: str | None = None,
    ) -> AuditInfo:
        info = AuditInfo(
            actor_type=actor_type,
            actor_id=actor_id,
            actor_name=actor_name,
            ip_address=ip_address,
        )
        cls._ctx.set(info)
        return info

    @classmethod
    def get(cls) -> AuditInfo | None:
        return cls._ctx.get()

    @classmethod
    def clear(cls) -> None:
        cls._ctx.set(None)
