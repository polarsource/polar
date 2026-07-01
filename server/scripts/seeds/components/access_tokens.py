"""Organization access token seed component."""

from __future__ import annotations

from polar.auth.scope import Scope
from polar.config import settings
from polar.kit.crypto import generate_token_hash_pair
from polar.models.organization_access_token import OrganizationAccessToken

from scripts.seeds.base import SeedContext, Variant

SCOPES = " ".join(
    [
        Scope.customers_read,
        Scope.products_read,
        Scope.orders_read,
        Scope.subscriptions_read,
        Scope.benefits_read,
    ]
)


class AccessTokensComponent:
    key = "access_tokens"
    label = "Organization access token"
    default_on = False
    requires: list[str] = []
    variants: list[Variant] = []

    async def build(self, ctx: SeedContext, variant: str | None) -> str:
        _token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix="polar_oat_"
        )
        ctx.session.add(
            OrganizationAccessToken(
                organization_id=ctx.organization.id,
                token=token_hash,
                scope=SCOPES,
                comment="Seed access token",
            )
        )
        return "1 access token"


component = AccessTokensComponent()
