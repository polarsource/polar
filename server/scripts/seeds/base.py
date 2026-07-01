"""Core abstractions for the modular seed system.

Each seed entity (products, customers, …) lives in its own module and exposes a
`component` that implements `SeedComponent`. The runner builds them in dependency
order, sharing a single `SeedContext` so later builders can read what earlier
ones created (e.g. orders reading `ctx.created["products"]`).
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Protocol

if TYPE_CHECKING:
    from polar.auth.models import AuthSubject
    from polar.models import Organization, User
    from polar.postgres import AsyncSession
    from polar.redis import Redis


class SeedError(Exception):
    """Raised when a seed cannot proceed (e.g. the org slug already exists)."""


@dataclass(frozen=True)
class Variant:
    key: str
    label: str


@dataclass
class SeedContext:
    session: AsyncSession
    redis: Redis
    organization: Organization
    owner: User
    auth_subject: AuthSubject[User]
    skip_tinybird: bool = False
    created: dict[str, Any] = field(default_factory=dict)


class SeedComponent(Protocol):
    key: str
    label: str
    default_on: bool
    requires: list[str]
    variants: list[Variant]

    async def build(self, ctx: SeedContext, variant: str | None) -> str: ...
