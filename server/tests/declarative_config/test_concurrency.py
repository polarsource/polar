import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Literal
from uuid import UUID

import pytest
from sqlalchemy import delete, func, select, text

from polar.auth.models import AuthSubject
from polar.auth.scope import Scope
from polar.catalog.repository import CatalogRepository
from polar.catalog.service import CatalogNotDraft
from polar.catalog.service import catalog as catalog_service
from polar.config import settings
from polar.declarative_config.schemas import Config
from polar.declarative_config.service import (
    declarative_config as declarative_config_service,
)
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import (
    Account,
    Catalog,
    CatalogBenefit,
    CatalogProduct,
    Organization,
    Product,
    User,
)
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncSession
from polar.redis import Redis
from tests.fixtures.database import get_database_url, save_fixture_factory
from tests.fixtures.random_objects import (
    create_account,
    create_organization,
    create_user,
)


def _config(price_amount: int) -> Config:
    return Config.model_validate(
        {
            "products": [
                {
                    "external_id": "pro",
                    "name": "Pro",
                    "recurring_interval": "month",
                    "prices": [{"amount_type": "fixed", "price_amount": price_amount}],
                }
            ]
        }
    )


async def _auth_subject(
    session: AsyncSession, organization_id: UUID
) -> AuthSubject[Organization]:
    organization = await session.get_one(Organization, organization_id)
    return AuthSubject(organization, set(Scope), None)


async def _wait_for_lock_waiter(sessionmaker: AsyncSessionMaker) -> None:
    async with sessionmaker() as session:
        for _ in range(500):
            waiting = await session.scalar(
                text(
                    "SELECT count(*) FROM pg_locks "
                    "WHERE locktype = 'advisory' AND NOT granted"
                )
            )
            if waiting:
                return
            await asyncio.sleep(0.01)
    raise AssertionError("The second transaction never waited for the catalog lock")


@pytest.fixture
async def sessionmaker(worker_id: str) -> AsyncIterator[AsyncSessionMaker]:
    engine = create_async_engine(
        dsn=get_database_url(worker_id),
        application_name=f"test_{worker_id}_catalog_publish_concurrency",
        pool_size=4,
        pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
    )
    yield create_async_sessionmaker(engine)
    await engine.dispose()


@pytest.fixture
async def organization_with_draft(
    sessionmaker: AsyncSessionMaker, redis: Redis
) -> AsyncIterator[UUID]:
    async with sessionmaker() as session:
        save_fixture = save_fixture_factory(session)
        user = await create_user(save_fixture)
        account = await create_account(save_fixture, user)
        organization = await create_organization(
            save_fixture,
            account,
            feature_settings={"config_as_code_enabled": True},
        )
        await session.commit()
        ids = (user.id, account.id, organization.id)

    for price_amount, publish in ((2000, True), (2500, False)):
        async with sessionmaker() as session:
            await declarative_config_service.apply(
                session,
                redis,
                await _auth_subject(session, organization.id),
                _config(price_amount),
                publish=publish,
            )
            await session.commit()

    yield organization.id

    user_id, account_id, organization_id = ids
    async with sessionmaker() as session:
        catalog_ids = select(Catalog.id).where(
            Catalog.organization_id == organization_id
        )
        await session.execute(
            delete(CatalogProduct).where(CatalogProduct.catalog_id.in_(catalog_ids))
        )
        await session.execute(
            delete(CatalogBenefit).where(CatalogBenefit.catalog_id.in_(catalog_ids))
        )
        await session.execute(
            delete(Product).where(Product.organization_id == organization_id)
        )
        await session.execute(
            delete(Catalog).where(Catalog.organization_id == organization_id)
        )
        await session.execute(
            delete(Organization).where(Organization.id == organization_id)
        )
        await session.execute(delete(Account).where(Account.id == account_id))
        await session.execute(delete(User).where(User.id == user_id))
        await session.commit()


@pytest.mark.anyio
class TestApplyAndPublishDraft:
    @pytest.mark.parametrize("first", ["publish_draft", "apply"])
    async def test_serialize(
        self,
        sessionmaker: AsyncSessionMaker,
        redis: Redis,
        organization_with_draft: UUID,
        first: Literal["publish_draft", "apply"],
    ) -> None:
        organization_id = organization_with_draft
        async with sessionmaker() as session:
            draft = await CatalogRepository.from_session(session).get_draft(
                organization_id
            )
            assert draft is not None
            draft_id = draft.id

        async def publish_draft(session: AsyncSession) -> None:
            organization = await session.get_one(Organization, organization_id)
            draft = await session.get_one(Catalog, draft_id)
            await catalog_service.publish_draft(
                session,
                await _auth_subject(session, organization_id),
                organization,
                draft,
            )

        async def apply(session: AsyncSession) -> None:
            await declarative_config_service.apply(
                session,
                redis,
                await _auth_subject(session, organization_id),
                _config(3000),
            )

        operations: dict[str, Callable[[AsyncSession], Awaitable[None]]] = {
            "publish_draft": publish_draft,
            "apply": apply,
        }
        second = "apply" if first == "publish_draft" else "publish_draft"

        async def run_second() -> None:
            async with sessionmaker() as session:
                await operations[second](session)
                await session.commit()

        async with sessionmaker() as session:
            await CatalogRepository.from_session(session).lock(organization_id)
            waiter = asyncio.create_task(run_second())
            await _wait_for_lock_waiter(sessionmaker)
            await operations[first](session)
            await session.commit()

        if first == "apply":
            with pytest.raises(CatalogNotDraft):
                await asyncio.wait_for(waiter, timeout=30)
        else:
            await asyncio.wait_for(waiter, timeout=30)

        async with sessionmaker() as session:
            catalogs = (
                await session.scalars(
                    select(Catalog).where(Catalog.organization_id == organization_id)
                )
            ).all()
            published_draft = await session.get_one(Catalog, draft_id)
            live_count = await session.scalar(
                select(func.count(Catalog.id)).where(
                    Catalog.organization_id == organization_id,
                    Catalog.status == CatalogStatus.live,
                    Catalog.deleted_at.is_(None),
                )
            )

        assert live_count == 1
        assert not [
            catalog
            for catalog in catalogs
            if catalog.published_at is not None and catalog.deleted_at is not None
        ]
        if first == "publish_draft":
            assert published_draft.status == CatalogStatus.archived
            assert published_draft.deleted_at is None
        else:
            assert published_draft.status == CatalogStatus.draft
            assert published_draft.deleted_at is not None
