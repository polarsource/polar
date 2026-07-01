"""Polar-self integration seed (the bespoke `polar` org).

Creates the Polar org with its self-billing catalog, an access token and a
webhook, and returns the env vars the CLI writes so Polar can bill itself
locally. Reuses the catalog builder + constants from `seeds_load.py` (that move
into this package is part of the cutover, see MIGRATION.md).
"""

from __future__ import annotations

from typing import Any

from sqlalchemy import select

from polar.config import settings
from polar.kit.crypto import generate_token, generate_token_hash_pair
from polar.models.organization_access_token import OrganizationAccessToken
from polar.models.product import Product
from polar.models.webhook_endpoint import WebhookEndpoint, WebhookFormat
from polar.postgres import AsyncSession
from polar.redis import Redis
from polar.webhook.constants import WEBHOOK_SECRET_PREFIX

from scripts.seeds.runner import DEFAULT_OWNER, _ensure_org_and_owner, _org_exists
from scripts.seeds_load import (
    POLAR_ORG_SLUG,
    SCALE_PRODUCT_NAME,
    TOKEN_COMMENT,
    TOKEN_SCOPES,
    WEBHOOK_EVENTS,
    WEBHOOK_NAME,
    WEBHOOK_URL,
    _seed_polar_self_billing_catalog,
)


async def seed_polar_self(
    session: AsyncSession, redis: Redis, *, slug: str = POLAR_ORG_SLUG
) -> dict[str, str]:
    if await _org_exists(session, slug):
        return {}

    organization, _owner, auth_subject = await _ensure_org_and_owner(
        session, slug, DEFAULT_OWNER
    )
    await _seed_polar_self_billing_catalog(session, redis, organization, auth_subject)

    scale_product = (
        await session.execute(
            select(Product).where(
                Product.organization_id == organization.id,
                Product.name == SCALE_PRODUCT_NAME,
            )
        )
    ).scalar_one_or_none()

    token, token_hash = generate_token_hash_pair(
        secret=settings.SECRET, prefix="polar_oat_"
    )
    session.add(
        OrganizationAccessToken(
            organization_id=organization.id,
            token=token_hash,
            scope=TOKEN_SCOPES,
            comment=TOKEN_COMMENT,
        )
    )

    webhook_secret = generate_token(prefix=WEBHOOK_SECRET_PREFIX)
    session.add(
        WebhookEndpoint(
            organization_id=organization.id,
            url=WEBHOOK_URL,
            name=WEBHOOK_NAME,
            format=WebhookFormat.raw,
            secret=webhook_secret,
            events=WEBHOOK_EVENTS,
            enabled=True,
        )
    )
    await session.flush()

    env: dict[str, str] = {
        "POLAR_POLAR_ORGANIZATION_ID": str(organization.id),
        "POLAR_POLAR_ACCESS_TOKEN": token,
        "POLAR_POLAR_WEBHOOK_SECRET": webhook_secret,
        "POLAR_POLAR_API_URL": "http://127.0.0.1:8000",
    }
    if scale_product is not None:
        env["POLAR_POLAR_SCALE_PRODUCT_ID"] = str(scale_product.id)
    return env
