import pytest

from polar.email.billing_migration import previous_billing_provider_for_notice
from polar.enums import EmailSender
from polar.models import Customer, Organization, Product, Subscription
from polar.models.email_log import EmailLog, EmailLogStatus
from polar.models.merchant_migration_record import MerchantMigrationCutoverStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription
from tests.merchant_migration._helpers import (
    build_connected_migration,
    stage_subscription_record,
)


async def _moved_subscription(
    save_fixture: SaveFixture,
    organization: Organization,
    product: Product,
    customer: Customer,
    *,
    cutover_status: MerchantMigrationCutoverStatus | None = (
        MerchantMigrationCutoverStatus.moved
    ),
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
        cutover_status=cutover_status,
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

        assert await previous_billing_provider_for_notice(session, subscription) is None

    async def test_imported_but_not_moved(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await _moved_subscription(
            save_fixture,
            organization,
            product,
            customer,
            cutover_status=None,
        )

        assert await previous_billing_provider_for_notice(session, subscription) is None

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
            await previous_billing_provider_for_notice(session, subscription)
            == "Stripe"
        )

    async def test_notice_already_sent(
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
        await save_fixture(
            EmailLog(
                status=EmailLogStatus.sent,
                processor=EmailSender.resend,
                to_email_addr=customer.email,
                from_email_addr="acme@polar.sh",
                from_name="Acme",
                subject="Your subscription renews soon",
                email_template="subscription_renewal_reminder",
                email_props={
                    "subscription": {"id": str(subscription.id)},
                    "previous_billing_provider": "Stripe",
                },
                organization_id=organization.id,
            )
        )

        assert await previous_billing_provider_for_notice(session, subscription) is None
