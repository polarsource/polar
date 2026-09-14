import pytest

from polar.email.billing_migration import previous_billing_provider_for_notice
from polar.email.schemas import EmailTemplate
from polar.models import Customer, Organization, Product, Subscription
from polar.models.merchant_migration_record import MerchantMigrationCutoverStatus
from polar.models.order import OrderBillingReasonInternal
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription, create_order
from tests.merchant_migration._helpers import (
    build_connected_migration,
    stage_subscription_record,
)


async def _moved_subscription(
    save_fixture: SaveFixture,
    organization: Organization,
    product: Product,
    customer: Customer,
) -> Subscription:
    subscription = await create_active_subscription(
        save_fixture, product=product, customer=customer
    )
    migration = await build_connected_migration(save_fixture, organization)
    await stage_subscription_record(
        save_fixture,
        migration,
        organization,
        subscription,
        cutover_status=MerchantMigrationCutoverStatus.moved,
    )
    return subscription


@pytest.mark.asyncio
class TestPreviousBillingProviderForNotice:
    async def test_not_imported(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        assert (
            await previous_billing_provider_for_notice(
                session, subscription, EmailTemplate.subscription_renewal_reminder
            )
            is None
        )

    async def test_moved_from_stripe(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await _moved_subscription(
            save_fixture, organization, product, customer
        )

        assert (
            await previous_billing_provider_for_notice(
                session, subscription, EmailTemplate.subscription_renewal_reminder
            )
            == "Stripe"
        )

    async def test_later_cycle(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await _moved_subscription(
            save_fixture, organization, product, customer
        )
        for _ in range(2):
            await create_order(
                save_fixture,
                product=product,
                customer=customer,
                subscription=subscription,
                billing_reason=OrderBillingReasonInternal.subscription_cycle,
            )

        assert (
            await previous_billing_provider_for_notice(
                session, subscription, EmailTemplate.subscription_cycled
            )
            is None
        )
