from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from freezegun import freeze_time

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.models import Customer, Organization
from polar.postgres import AsyncSession
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_product,
)


@pytest.mark.asyncio
class TestSendRenewalReminders:
    @freeze_time("2025-01-01 12:00:00")
    async def test_sends_reminder_for_yearly_subscription_7_days_before_renewal(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        mocker: MagicMock,
    ) -> None:
        # Enable renewal reminders for organization
        organization.customer_email_settings["subscription_renewal_reminder"] = True
        await save_fixture(organization)

        # Create a yearly subscription that renews in exactly 7 days
        now = utc_now()
        renewal_date = now + timedelta(days=7, hours=3)  # 7 days and 3 hours ahead

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.current_period_end = renewal_date
        subscription.renewal_reminder_sent_at = None
        subscription.stripe_subscription_id = (
            None  # Clear to indicate Polar-managed subscription
        )
        await save_fixture(subscription)

        # Mock the email sending method
        mock_send_email = mocker.patch.object(
            subscription_service, "send_renewal_reminder_email", new=AsyncMock()
        )

        # When
        await subscription_service.send_renewal_reminders(session)
        await session.flush()

        # Then
        mock_send_email.assert_called_once()
        assert mock_send_email.call_args[0][1].id == subscription.id

        # Verify reminder was marked as sent
        await session.refresh(subscription)
        assert subscription.renewal_reminder_sent_at is not None

    async def test_does_not_send_reminder_when_organization_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        mocker: MagicMock,
    ) -> None:
        # Disable renewal reminders for organization
        organization.customer_email_settings["subscription_renewal_reminder"] = False
        await save_fixture(organization)

        # Create a yearly subscription that renews in 7 days
        now = utc_now()
        renewal_date = now + timedelta(days=7)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.current_period_end = renewal_date
        subscription.renewal_reminder_sent_at = None
        subscription.stripe_subscription_id = None
        await save_fixture(subscription)

        # Mock the email sending method
        mock_send_email = mocker.patch.object(
            subscription_service, "send_renewal_reminder_email", new=AsyncMock()
        )

        # When
        await subscription_service.send_renewal_reminders(session)

        # Then
        mock_send_email.assert_not_called()

    async def test_does_not_send_reminder_for_monthly_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        mocker: MagicMock,
    ) -> None:
        # Enable renewal reminders for organization
        organization.customer_email_settings["subscription_renewal_reminder"] = True
        await save_fixture(organization)

        # Create a monthly subscription that renews in 7 days
        now = utc_now()
        renewal_date = now + timedelta(days=7)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.current_period_end = renewal_date
        subscription.renewal_reminder_sent_at = None
        subscription.stripe_subscription_id = None
        await save_fixture(subscription)

        # Mock the email sending method
        mock_send_email = mocker.patch.object(
            subscription_service, "send_renewal_reminder_email", new=AsyncMock()
        )

        # When
        await subscription_service.send_renewal_reminders(session)

        # Then
        mock_send_email.assert_not_called()

    async def test_does_not_send_duplicate_reminders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        mocker: MagicMock,
    ) -> None:
        # Enable renewal reminders for organization
        organization.customer_email_settings["subscription_renewal_reminder"] = True
        await save_fixture(organization)

        # Create a yearly subscription that renews in 7 days with reminder already sent
        now = utc_now()
        renewal_date = now + timedelta(days=7)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.current_period_end = renewal_date
        subscription.renewal_reminder_sent_at = now - timedelta(days=1)
        subscription.stripe_subscription_id = None
        await save_fixture(subscription)

        # Mock the email sending method
        mock_send_email = mocker.patch.object(
            subscription_service, "send_renewal_reminder_email", new=AsyncMock()
        )

        # When
        await subscription_service.send_renewal_reminders(session)

        # Then
        mock_send_email.assert_not_called()

    async def test_does_not_send_reminder_for_stripe_managed_subscription(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        mocker: MagicMock,
    ) -> None:
        # Enable renewal reminders for organization
        organization.customer_email_settings["subscription_renewal_reminder"] = True
        await save_fixture(organization)

        # Create a yearly subscription with Stripe ID
        now = utc_now()
        renewal_date = now + timedelta(days=7)

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.year,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )
        subscription.current_period_end = renewal_date
        subscription.renewal_reminder_sent_at = None
        subscription.stripe_subscription_id = "sub_test123"
        await save_fixture(subscription)

        # Mock the email sending method
        mock_send_email = mocker.patch.object(
            subscription_service, "send_renewal_reminder_email", new=AsyncMock()
        )

        # When
        await subscription_service.send_renewal_reminders(session)

        # Then
        mock_send_email.assert_not_called()
