from decimal import Decimal

import pytest
import pytest_asyncio

from polar.auth.models import AuthSubject
from polar.enums import SubscriptionRecurringInterval
from polar.exceptions import PolarRequestValidationError
from polar.meter.service import meter as meter_service
from polar.models import Benefit, Customer, Meter, Organization, Product, Subscription
from polar.models.benefit import BenefitType
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
)


@pytest_asyncio.fixture
async def product_metered_unit(
    save_fixture: SaveFixture, meter: Meter, organization: Organization
) -> Product:
    return await create_product(
        save_fixture,
        organization=organization,
        recurring_interval=SubscriptionRecurringInterval.month,
        prices=[(meter, Decimal(100), None)],
    )


@pytest_asyncio.fixture
async def metered_subscription(
    save_fixture: SaveFixture, customer: Customer, product_metered_unit: Product
) -> Subscription:
    return await create_active_subscription(
        save_fixture, customer=customer, product=product_metered_unit
    )


@pytest.mark.asyncio
class TestMeterArchive:
    async def test_archive_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        # Archive meter with no attachments
        result = await meter_service.archive(session, meter)

        assert result.archived_at is not None
        assert meter.archived_at is not None

    async def test_archive_with_active_product_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        product_metered_unit: Product,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        # Try to archive meter that's attached to an active product
        with pytest.raises(PolarRequestValidationError) as exc:
            await meter_service.archive(session, meter)
        assert "Cannot archive meter that is still attached to active products" in str(
            exc.value
        )

    async def test_archive_with_archived_product_price(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        product_metered_unit: Product,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        # Archive the product price first
        price = product_metered_unit.prices[0]
        price.is_archived = True
        await save_fixture(price)

        # Now archiving the meter should succeed
        result = await meter_service.archive(session, meter)

        assert result.archived_at is not None

    async def test_archive_with_active_benefit(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        # Create a benefit that references the meter
        benefit = Benefit(
            type=BenefitType.meter_credit,
            properties={"meter_id": str(meter.id), "units": 100, "rollover": True},
            organization=organization,
            description="Test meter credit benefit",
        )
        await save_fixture(benefit)

        # Try to archive meter that's referenced by an active benefit
        with pytest.raises(PolarRequestValidationError) as exc:
            await meter_service.archive(session, meter)
        assert (
            "Cannot archive meter that is still referenced by active benefits"
            in str(exc.value)
        )

    async def test_unarchive_success(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        meter: Meter,
        organization: Organization,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        # First archive the meter
        await meter_service.archive(session, meter)
        assert meter.archived_at is not None

        # Then unarchive it
        result = await meter_service.unarchive(session, meter)

        assert result.archived_at is None
        assert meter.archived_at is None
