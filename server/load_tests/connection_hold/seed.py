"""Seed the benchmark database: one user and organization, credentials, 20 products.

Prints the organization ID, an organization access token and a user session cookie as
JSON on stdout.
"""

import asyncio
import json
import sys
from datetime import timedelta

from polar.auth.scope import Scope
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.enums import SubscriptionRecurringInterval
from polar.kit.crypto import generate_token_hash_pair
from polar.kit.db.postgres import create_async_engine, create_async_sessionmaker
from polar.kit.utils import utc_now
from polar.models import Model, OrganizationAccessToken, UserOrganization
from polar.models.user_organization import OrganizationRole
from polar.organization_access_token.service import TOKEN_PREFIX
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_product,
    create_user,
)


async def main() -> None:
    engine = create_async_engine(
        dsn=str(settings.get_postgres_dsn("asyncpg")), pool_size=2, pool_recycle=600
    )
    async with create_async_sessionmaker(engine)() as session:

        async def save(model: Model) -> None:
            session.add(model)
            await session.flush()

        user = await create_user(save)
        account = await create_account(save, user)
        organization = await create_organization(save, account)
        await save(
            UserOrganization(
                user=user, organization=organization, role=OrganizationRole.owner
            )
        )
        for i in range(20):
            await create_product(
                save,
                organization=organization,
                name=f"Product {i}",
                recurring_interval=SubscriptionRecurringInterval.month
                if i % 2
                else None,
            )

        token, token_hash = generate_token_hash_pair(prefix=TOKEN_PREFIX)
        await save(
            OrganizationAccessToken(
                comment="connection-hold benchmark",
                token=token_hash,
                scope=f"{Scope.products_read} {Scope.customers_read} "
                f"{Scope.customers_write}",
                organization=organization,
                expires_at=utc_now() + timedelta(days=1),
            )
        )
        cookie, _ = await auth_service._create_user_session(
            session, user, user_agent="connection-hold-benchmark", scopes=list(Scope)
        )
        await session.commit()

    await engine.dispose()
    json.dump(
        {
            "organization_id": str(organization.id),
            "organization_token": token,
            "user_session_cookie": cookie,
            "cookie_name": settings.USER_SESSION_COOKIE_KEY,
        },
        sys.stdout,
    )


asyncio.run(main())
