from datetime import timedelta

import pytest

from polar.checkout.repository import CheckoutRepository
from polar.kit.utils import utc_now
from polar.models import Product
from polar.models.checkout import CheckoutStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout


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
        assert expired_checkouts[0].id == expired_checkout.id

        # Verify statuses are not modified by the repository method
        updated_open_checkout = await repository.get_by_id(open_checkout.id)
        assert updated_open_checkout is not None
        assert updated_open_checkout.status == CheckoutStatus.open

        updated_expired_checkout = await repository.get_by_id(expired_checkout.id)
        assert updated_expired_checkout is not None
        assert updated_expired_checkout.status == CheckoutStatus.open  # Still open, not expired

        updated_successful_checkout = await repository.get_by_id(successful_checkout.id)
        assert updated_successful_checkout is not None
        assert updated_successful_checkout.status == CheckoutStatus.succeeded
