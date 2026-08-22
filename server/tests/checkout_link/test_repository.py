import asyncio
from uuid import UUID

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import selectinload

from polar.checkout_link.repository import CheckoutLinkRepository
from polar.config import settings
from polar.kit.db.postgres import (
    AsyncSession,
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import Account, CheckoutLink, Organization, Product
from tests.fixtures.database import (
    SaveFixture,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_checkout_link,
    create_organization,
    create_product,
)


async def _archive_product(sessionmaker: AsyncSessionMaker, product_id: UUID) -> None:
    async with sessionmaker() as session:
        repository = CheckoutLinkRepository.from_session(session)
        await repository.archive_product(product_id)
        await session.commit()


@pytest.mark.asyncio
class TestArchiveProduct:
    async def test_soft_delete_if_all_archived(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
    ) -> None:
        repository = CheckoutLinkRepository.from_session(session)

        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product],
        )
        session.expunge_all()

        await repository.archive_product(product.id)

        updated_checkout_link = await repository.get_by_id(
            checkout_link.id,
            include_deleted=True,
            options=(selectinload(CheckoutLink.checkout_link_products),),
        )
        assert updated_checkout_link is not None
        assert updated_checkout_link.deleted_at is not None
        assert updated_checkout_link.checkout_link_products == []

    async def test_not_soft_delete_if_other_products_active(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        product_second: Product,
    ) -> None:
        repository = CheckoutLinkRepository.from_session(session)

        checkout_link = await create_checkout_link(
            save_fixture,
            products=[product, product_second],
        )
        session.expunge_all()

        await repository.archive_product(product.id)

        updated_checkout_link = await repository.get_by_id(
            checkout_link.id,
            options=(selectinload(CheckoutLink.checkout_link_products),),
        )
        assert updated_checkout_link is not None
        assert updated_checkout_link.deleted_at is None
        assert len(updated_checkout_link.checkout_link_products) == 1

    async def test_concurrent_archives_soft_delete_empty_link(
        self, worker_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_checkout_link_archive_concurrency",
            pool_size=4,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            account = Account(currency="usd", processor_fees_applicable=True)
            await save_fixture(account)
            organization = await create_organization(save_fixture, account)
            products = [
                await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=None,
                    name=f"Concurrent product {index}",
                )
                for index in range(3)
            ]
            checkout_link = await create_checkout_link(save_fixture, products=products)
            await setup_session.commit()

        try:
            await asyncio.gather(
                *(_archive_product(sessionmaker, product.id) for product in products)
            )

            async with sessionmaker() as verification_session:
                repository = CheckoutLinkRepository.from_session(verification_session)
                updated_checkout_link = await repository.get_by_id(
                    checkout_link.id,
                    include_deleted=True,
                    options=(selectinload(CheckoutLink.checkout_link_products),),
                )

            assert updated_checkout_link is not None
            assert updated_checkout_link.deleted_at is not None
            assert updated_checkout_link.checkout_link_products == []
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.commit()
            await engine.dispose()
