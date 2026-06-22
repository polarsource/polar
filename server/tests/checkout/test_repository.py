from datetime import timedelta

import pytest

from polar.checkout.repository import CheckoutRepository
from polar.kit.utils import utc_now
from polar.models import Organization, Product
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_discount


@pytest.mark.asyncio
class TestExpireOpenCheckouts:
    async def test_valid(
        self, save_fixture: SaveFixture, session: AsyncSession, product: Product
    ) -> None:
        open_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() + timedelta(days=1),
        )
        expired_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.open,
            expires_at=utc_now() - timedelta(days=1),
        )
        successful_checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.succeeded,
            expires_at=utc_now() - timedelta(days=1),
        )

        repository = CheckoutRepository.from_session(session)
        expired_checkouts = await repository.expire_open_checkouts()

        # Verify only the expired open checkout is returned
        assert len(expired_checkouts) == 1
        assert expired_checkouts[0] == expired_checkout.id

        # Verify statuses are properly updated
        updated_open_checkout = await repository.get_by_id(open_checkout.id)
        assert updated_open_checkout is not None
        assert updated_open_checkout.status == CheckoutStatus.open

        updated_expired_checkout = await repository.get_by_id(expired_checkout.id)
        assert updated_expired_checkout is not None
        assert updated_expired_checkout.status == CheckoutStatus.expired

        updated_successful_checkout = await repository.get_by_id(successful_checkout.id)
        assert updated_successful_checkout is not None
        assert updated_successful_checkout.status == CheckoutStatus.succeeded


@pytest.mark.asyncio
async def test_for_update_eager_loading(
    save_fixture: SaveFixture,
    session: AsyncSession,
    product: Product,
    organization: Organization,
) -> None:
    discount = await create_discount(
        save_fixture,
        type=DiscountType.percentage,
        basis_points=5_000,
        duration=DiscountDuration.once,
        organization=organization,
        code="TESTCODE",
        products=[product],
    )
    checkout = await create_checkout(
        save_fixture, products=[product], discount=discount
    )
    assert checkout.product is not None

    repository = CheckoutRepository.from_session(session)

    # Fetch the checkout with for_update and eager loading
    fetched_checkout = await repository.get_by_client_secret(
        checkout.client_secret, for_update=True, options=repository.get_eager_options()
    )

    assert fetched_checkout is not None
    assert fetched_checkout.id == checkout.id
    assert fetched_checkout.product is not None
    assert fetched_checkout.product.attached_custom_fields == []
    for product in fetched_checkout.products:
        assert product.product_medias == []
    assert fetched_checkout.discount is not None
    assert fetched_checkout.discount.products == [product]
