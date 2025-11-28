import pytest
from sqlalchemy.orm import selectinload

from polar.checkout_link.repository import CheckoutLinkRepository
from polar.models import CheckoutLink, Product
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout_link


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
