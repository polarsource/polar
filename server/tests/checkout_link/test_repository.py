import asyncio
import uuid

import pytest
from sqlalchemy import delete
from sqlalchemy.orm import selectinload

from polar.checkout_link.repository import CheckoutLinkRepository
from polar.config import settings
from polar.kit.db.postgres import (
    AsyncSessionMaker,
    create_async_engine,
    create_async_sessionmaker,
)
from polar.models import Account, CheckoutLink, Organization, Product, User
from polar.postgres import AsyncSession
from tests.fixtures.database import (
    SaveFixture,
    get_database_url,
    save_fixture_factory,
)
from tests.fixtures.random_objects import (
    create_account,
    create_checkout_link,
    create_organization,
    create_product,
    create_user,
)


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


async def _attempt_archive_product(
    sessionmaker: AsyncSessionMaker,
    product_id: uuid.UUID,
    barrier: asyncio.Barrier,
) -> None:
    async with sessionmaker() as session:
        await barrier.wait()
        repository = CheckoutLinkRepository.from_session(session)
        await repository.archive_product(product_id)
        await session.commit()


@pytest.mark.asyncio
class TestArchiveProductConcurrency:
    async def test_concurrent_archive_of_every_product_soft_deletes_the_link(
        self, worker_id: str
    ) -> None:
        engine = create_async_engine(
            dsn=get_database_url(worker_id),
            application_name=f"test_{worker_id}_checkout_link_archive_concurrency",
            pool_size=8,
            pool_recycle=settings.DATABASE_POOL_RECYCLE_SECONDS,
        )
        sessionmaker = create_async_sessionmaker(engine)

        async with sessionmaker() as setup_session:
            save_fixture = save_fixture_factory(setup_session)
            user = await create_user(save_fixture)
            account = await create_account(save_fixture, user)
            organization = await create_organization(save_fixture, account)
            products = [
                await create_product(
                    save_fixture,
                    organization=organization,
                    recurring_interval=None,
                    name=f"Product {index}",
                )
                for index in range(3)
            ]
            checkout_link = await create_checkout_link(save_fixture, products=products)
            await setup_session.commit()

        try:
            barrier = asyncio.Barrier(len(products))
            await asyncio.gather(
                *(
                    _attempt_archive_product(sessionmaker, product.id, barrier)
                    for product in products
                )
            )

            async with sessionmaker() as session:
                repository = CheckoutLinkRepository.from_session(session)
                updated_checkout_link = await repository.get_by_id(
                    checkout_link.id,
                    include_deleted=True,
                    options=(selectinload(CheckoutLink.checkout_link_products),),
                )
                assert updated_checkout_link is not None
                assert updated_checkout_link.checkout_link_products == []
                assert updated_checkout_link.deleted_at is not None
        finally:
            async with sessionmaker() as cleanup_session:
                await cleanup_session.execute(
                    delete(CheckoutLink).where(CheckoutLink.id == checkout_link.id)
                )
                await cleanup_session.execute(
                    delete(Product).where(Product.organization_id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Organization).where(Organization.id == organization.id)
                )
                await cleanup_session.execute(
                    delete(Account).where(Account.id == account.id)
                )
                await cleanup_session.execute(delete(User).where(User.id == user.id))
                await cleanup_session.commit()
            await engine.dispose()
