import uuid
from datetime import timedelta

import pytest
from freezegun.api import freeze_time
from pytest_mock import MockerFixture

from polar.email.schemas import SubscriptionRevokedEmail
from polar.enums import SubscriptionRecurringInterval
from polar.event.repository import EventRepository
from polar.kit.utils import utc_now
from polar.models import (
    Customer,
    Meter,
    Organization,
    PaymentMethod,
    Product,
    Subscription,
)
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderBillingReasonInternal
from polar.models.organization import OrganizationStatus
from polar.models.subscription import SubscriptionStatus
from polar.models.webhook_endpoint import WebhookEventType
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.subscription.service import SubscriptionMeterCycleLag, SubscriptionService
from polar.subscription.tasks import (  # type: ignore[attr-defined]
    SubscriptionDoesNotExist,
    SubscriptionTierDoesNotExist,
    scan_grace_expired_revocations,
    subscription_cancel_for_organization,
    subscription_cycle,
    subscription_enqueue_benefits_grants,
    subscription_resume,
    subscription_service,
    subscription_update_product_benefits_grants,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_benefit,
    create_benefit_grant,
    create_discount,
    create_subscription,
    create_trialing_subscription,
)


@pytest.mark.anyio
class TestSubscriptionCancelForOrganization:
    async def test_cancels_organization_subscriptions(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        product: Product,
        customer: Customer,
    ) -> None:
        organization.status = OrganizationStatus.DENIED
        await save_fixture(organization)
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        session.expunge_all()

        await subscription_cancel_for_organization(product.organization_id)

        refreshed = await session.get(Subscription, subscription.id)
        assert refreshed is not None
        assert refreshed.status == SubscriptionStatus.canceled

    async def test_reenqueues_when_work_remains(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        organization_id = uuid.uuid4()
        mocker.patch.object(
            subscription_service,
            "cancel_for_organization",
            return_value=True,
        )
        enqueue_job_mock = mocker.patch("polar.subscription.tasks.enqueue_job")

        session.expunge_all()

        await subscription_cancel_for_organization(organization_id)

        enqueue_job_mock.assert_called_once_with(
            "subscription.cancel_for_organization", organization_id=organization_id
        )

    async def test_does_not_reenqueue_when_done(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
    ) -> None:
        mocker.patch.object(
            subscription_service,
            "cancel_for_organization",
            return_value=False,
        )
        enqueue_job_mock = mocker.patch("polar.subscription.tasks.enqueue_job")

        session.expunge_all()

        await subscription_cancel_for_organization(uuid.uuid4())

        enqueue_job_mock.assert_not_called()


@pytest.mark.anyio
class TestSubscriptionUpdateProductBenefitsGrants:
    async def test_not_existing_subscription_tier(self, session: AsyncSession) -> None:
        # then
        session.expunge_all()

        with pytest.raises(SubscriptionTierDoesNotExist):
            await subscription_update_product_benefits_grants(uuid.uuid4())

    async def test_existing_subscription_tier(
        self,
        mocker: MockerFixture,
        product: Product,
        session: AsyncSession,
    ) -> None:
        update_product_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "update_product_benefits_grants",
            spec=SubscriptionService.update_product_benefits_grants,
        )

        # then
        session.expunge_all()

        await subscription_update_product_benefits_grants(product.id)

        update_product_benefits_grants_mock.assert_called_once()


@pytest.mark.anyio
class TestSubscriptionEnqueueBenefitsGrants:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_enqueue_benefits_grants(uuid.uuid4())

    async def test_existing_subscription(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer
        )
        enqueue_benefits_grants_mock = mocker.patch.object(
            subscription_service,
            "enqueue_benefits_grants",
            spec=SubscriptionService.enqueue_benefits_grants,
        )

        session.expunge_all()

        await subscription_enqueue_benefits_grants(subscription.id)

        enqueue_benefits_grants_mock.assert_called_once()


@pytest.mark.anyio
class TestSubscriptionResume:
    async def test_not_existing_subscription(self, session: AsyncSession) -> None:
        session.expunge_all()

        with pytest.raises(SubscriptionDoesNotExist):
            await subscription_resume(uuid.uuid4())

    async def test_due_paused_subscription_is_resumed(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )
        subscription.resumes_at = utc_now() - timedelta(hours=1)
        await save_fixture(subscription)
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_called_once()

    async def test_not_paused_subscription_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture, product=product, customer=customer
        )
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()

    async def test_indefinite_pause_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
        )
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()

    async def test_postponed_resume_is_skipped(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.paused,
            scheduler_locked_at=utc_now(),
        )
        subscription.resumes_at = utc_now() + timedelta(days=1)
        await save_fixture(subscription)
        resume_mock = mocker.patch.object(
            subscription_service, "resume", spec=SubscriptionService.resume
        )
        session.expunge_all()

        await subscription_resume(subscription.id)

        resume_mock.assert_not_called()


@pytest.mark.anyio
class TestSubscriptionCycle:
    @pytest.mark.parametrize("metered", [False, True])
    async def test_trial_end_without_payment_method(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        product_recurring_metered: Product,
        customer: Customer,
        meter: Meter,
        metered: bool,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        enqueue_email_mock = mocker.patch(
            "polar.subscription.service.enqueue_email_template"
        )
        webhook_send_mock = mocker.patch(
            "polar.subscription.service.webhook_service.send"
        )
        if metered:
            product = product_recurring_metered
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )
        previous_period_end = subscription.current_period_end
        subscription.pause_at_period_end = True
        subscription.resumes_at = previous_period_end + timedelta(days=7)
        await save_fixture(subscription)
        session.expunge_all()

        with freeze_time(previous_period_end):
            await subscription_cycle(subscription.id)

        updated_subscription = await session.get(Subscription, subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.customer_cancellation_reason is None
        assert updated_subscription.ended_at == previous_period_end
        assert updated_subscription.canceled_at == updated_subscription.ended_at
        assert updated_subscription.ends_at == updated_subscription.ended_at
        assert updated_subscription.past_due_at is None
        assert updated_subscription.current_period_end == previous_period_end
        assert updated_subscription.scheduler_locked_at is None
        assert updated_subscription.pause_at_period_end is False
        assert updated_subscription.resumes_at is None
        enqueue_job_mock.assert_any_call(
            "benefit.enqueue_benefits_grants",
            task="revoke",
            customer_id=customer.id,
            product_id=product.id,
            subscription_id=subscription.id,
            delay=None,
        )
        assert all(
            call.args[0] != "order.create_subscription_order"
            for call in enqueue_job_mock.call_args_list
        )
        order_repository = OrderRepository.from_session(session)
        assert await order_repository.get_all_by_subscription(subscription.id) == []
        webhook_events = [call.args[2] for call in webhook_send_mock.call_args_list]
        assert webhook_events.count(WebhookEventType.subscription_canceled) == 1
        assert webhook_events.count(WebhookEventType.subscription_revoked) == 1
        assert WebhookEventType.subscription_cycled not in webhook_events
        enqueue_email_mock.assert_called_once()
        assert isinstance(enqueue_email_mock.call_args[0][0], SubscriptionRevokedEmail)
        if metered:
            event_repository = EventRepository.from_session(session)
            meter_reset = await event_repository.get_latest_meter_reset(
                customer, meter.id
            )
            assert meter_reset is not None
            assert meter_reset.timestamp == previous_period_end

    async def test_trial_end_with_discount_expiring_at_conversion(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        mocker.patch("polar.subscription.service.enqueue_job")
        discount = await create_discount(
            save_fixture,
            type=DiscountType.percentage,
            basis_points=10_000,
            duration=DiscountDuration.once,
            organization=organization,
        )
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount,
            scheduler_locked_at=utc_now(),
        )
        subscription.discount_applied_at = subscription.current_period_start
        await save_fixture(subscription)
        assert subscription.amount == 0
        previous_period_end = subscription.current_period_end
        session.expunge_all()

        with freeze_time(previous_period_end):
            await subscription_cycle(subscription.id)

        updated_subscription = await session.get(Subscription, subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.canceled
        assert updated_subscription.current_period_end == previous_period_end
        order_repository = OrderRepository.from_session(session)
        assert await order_repository.get_all_by_subscription(subscription.id) == []

    async def test_trial_end_with_renewals_disabled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        organization.capabilities = {
            **organization.capabilities,
            "subscription_renewals": False,
        }
        await save_fixture(organization)
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )
        previous_period_end = subscription.current_period_end
        session.expunge_all()

        with freeze_time(previous_period_end):
            await subscription_cycle(subscription.id)

        updated_subscription = await session.get(Subscription, subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.trialing
        assert updated_subscription.current_period_end == previous_period_end
        assert updated_subscription.scheduler_locked_at is None

    @pytest.mark.parametrize(
        "conversion_reason",
        ["subscription_payment_method", "customer_payment_method", "free", "discount"],
    )
    async def test_trial_converts(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        product_recurring_free_price: Product,
        customer: Customer,
        payment_method: PaymentMethod,
        organization: Organization,
        conversion_reason: str,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.subscription.service.enqueue_job")
        discount = None
        if conversion_reason == "customer_payment_method":
            customer.default_payment_method = payment_method
            await save_fixture(customer)
        elif conversion_reason == "free":
            product = product_recurring_free_price
        elif conversion_reason == "discount":
            discount = await create_discount(
                save_fixture,
                type=DiscountType.percentage,
                basis_points=10_000,
                duration=DiscountDuration.forever,
                organization=organization,
            )
        subscription = await create_trialing_subscription(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount,
            payment_method=(
                payment_method
                if conversion_reason == "subscription_payment_method"
                else None
            ),
            scheduler_locked_at=utc_now(),
        )
        trial_start = subscription.current_period_start
        previous_period_end = subscription.current_period_end
        assert previous_period_end is not None
        session.expunge_all()

        with freeze_time(previous_period_end):
            await subscription_cycle(subscription.id)

        updated_subscription = await session.get(Subscription, subscription.id)
        assert updated_subscription is not None
        assert updated_subscription.status == SubscriptionStatus.active
        assert updated_subscription.ended_at is None
        assert updated_subscription.scheduler_locked_at is None
        enqueue_job_mock.assert_any_call(
            "order.create_subscription_order",
            subscription.id,
            OrderBillingReasonInternal.subscription_cycle_after_trial,
            cutoff=previous_period_end.isoformat(),
            period_start=trial_start.isoformat(),
        )

    async def test_multi_period_lag_raises_and_halts(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=utc_now(),
        )
        now = utc_now()
        subscription.meter_interval = SubscriptionRecurringInterval.month
        subscription.meter_interval_count = 1
        subscription.current_meter_period_start = now - timedelta(days=93)
        subscription.current_meter_period_end = now - timedelta(days=62)
        await save_fixture(subscription)

        session.expunge_all()

        with pytest.raises(SubscriptionMeterCycleLag):
            await subscription_cycle(subscription.id)

    async def test_billing_due_with_multi_period_meter_lag(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        # When billing is due AND the meter clock is more than one period behind,
        # the cycle must still halt for manual catch-up: cycle() would re-arm the
        # meter clock off the billing period and silently erase the lag.
        now = utc_now()
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=now,
            current_period_start=now - timedelta(days=32),
            current_period_end=now - timedelta(days=2),  # billing_due=True
        )
        subscription.meter_interval = SubscriptionRecurringInterval.month
        subscription.meter_interval_count = 1
        subscription.current_meter_period_start = now - timedelta(days=93)
        subscription.current_meter_period_end = now - timedelta(
            days=62
        )  # >1 period lag
        await save_fixture(subscription)

        session.expunge_all()

        with pytest.raises(SubscriptionMeterCycleLag):
            await subscription_cycle(subscription.id)

    @freeze_time("2026-01-01 12:00:00")
    async def test_billing_due_without_meter_lag_cycles(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
    ) -> None:
        # billing_due AND meter_due, but the meter lag is within a single period:
        # the guard must not over-halt, and the billing cycle proceeds normally.
        now = utc_now()
        old_period_end = now - timedelta(days=2)
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
            scheduler_locked_at=now,
            current_period_start=now - timedelta(days=32),
            current_period_end=old_period_end,  # billing_due=True
        )
        subscription.meter_interval = SubscriptionRecurringInterval.month
        subscription.meter_interval_count = 1
        # Meter aligned with the billing boundary: due, but next period is ahead.
        subscription.current_meter_period_start = now - timedelta(days=32)
        subscription.current_meter_period_end = old_period_end  # meter_due=True, no lag
        subscription.anchor_day = old_period_end.day
        await save_fixture(subscription)

        session.expunge_all()

        await subscription_cycle(subscription.id)

        refreshed = await session.get(Subscription, subscription.id)
        assert refreshed is not None
        assert refreshed.scheduler_locked_at is None
        assert refreshed.current_period_end is not None
        assert refreshed.current_period_end > old_period_end


@pytest.mark.anyio
class TestScanGraceExpiredRevocations:
    @pytest.mark.parametrize(
        ("grace_period_days", "past_due_days", "grant_active", "should_enqueue"),
        [
            pytest.param(2, 3, True, True, id="grace-expired"),
            pytest.param(2, 1, True, False, id="within-grace"),
            pytest.param(0, 5, True, False, id="no-grace-period"),
            pytest.param(2, 3, False, False, id="grant-revoked"),
        ],
    )
    async def test_past_due_subscription(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        product: Product,
        customer: Customer,
        grace_period_days: int,
        past_due_days: int,
        grant_active: bool,
        should_enqueue: bool,
    ) -> None:
        organization = product.organization
        organization.subscription_settings = {
            **organization.subscription_settings,
            "benefit_revocation_grace_period": grace_period_days,
        }
        await save_fixture(organization)
        subscription = await create_subscription(
            save_fixture,
            product=product,
            customer=customer,
            status=SubscriptionStatus.past_due,
            past_due_at=utc_now() - timedelta(days=past_due_days),
        )
        benefit = await create_benefit(save_fixture, organization=organization)
        await create_benefit_grant(
            save_fixture,
            customer=customer,
            benefit=benefit,
            granted=grant_active,
            subscription=subscription,
        )
        enqueue_job_mock = mocker.patch("polar.subscription.tasks.enqueue_job")

        session.expunge_all()

        await scan_grace_expired_revocations()

        if should_enqueue:
            enqueue_job_mock.assert_called_once_with(
                "subscription.enqueue_benefits_grants", subscription.id
            )
        else:
            enqueue_job_mock.assert_not_called()
