import pytest

from polar.models import Customer, Organization, Product
from polar.models.payment import (
    DUNNING_COUNTING_TRIGGERS,
    DUNNING_NON_COUNTING_TRIGGERS,
    PaymentStatus,
    PaymentTrigger,
)
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment


def test_every_payment_trigger_is_classified() -> None:
    """Force a deliberate decision when a new ``PaymentTrigger`` is added.

    Adding a new value without also updating ``DUNNING_COUNTING_TRIGGERS``
    or ``DUNNING_NON_COUNTING_TRIGGERS`` would silently default the new
    trigger to "not counted toward the dunning ceiling" — which has bitten
    us before. Fail loudly instead.
    """
    classified = DUNNING_COUNTING_TRIGGERS | DUNNING_NON_COUNTING_TRIGGERS
    missing = set(PaymentTrigger) - classified
    overlap = DUNNING_COUNTING_TRIGGERS & DUNNING_NON_COUNTING_TRIGGERS

    assert not missing, (
        f"Unclassified PaymentTrigger value(s): {sorted(t.value for t in missing)}. "
        f"Add to DUNNING_COUNTING_TRIGGERS (if it consumes the retry budget) "
        f"or DUNNING_NON_COUNTING_TRIGGERS (if it's a one-shot recovery)."
    )
    assert not overlap, (
        f"PaymentTrigger value(s) in both sets: {sorted(t.value for t in overlap)}. "
        f"A trigger must either count toward dunning or not — pick one."
    )


@pytest.mark.asyncio
class TestCountFailedPaymentsForOrder:
    """The dunning ceiling counts failed payments to decide when to revoke a
    subscription. Only the original ``purchase`` attempt and automated dunning
    retries (``retry_dunning``) should count toward that ceiling — customer-
    initiated retries from the portal (``retry_customer``) and one-shot
    recovery attempts triggered by a payment-method update
    (``retry_payment_method_update``) must be excluded so they don't shorten
    the dunning window.
    """

    async def test_excludes_customer_retries(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        # The original cycle attempt fails.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        # Customer rapid-double-clicks "Retry" twice from the portal.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_customer,
            order=order,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_customer,
            order=order,
        )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        assert count == 1

    async def test_excludes_payment_method_update_retries(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        # The customer saves a new default payment method, which fires a
        # one-shot recovery retry. It should not eat into the dunning budget.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_payment_method_update,
            order=order,
        )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        assert count == 1

    async def test_counts_dunning_retries(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        for _ in range(3):
            await create_payment(
                save_fixture,
                organization,
                status=PaymentStatus.failed,
                trigger=PaymentTrigger.retry_dunning,
                order=order,
            )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        assert count == 4

    async def test_excludes_succeeded_payments(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.succeeded,
            trigger=PaymentTrigger.retry_dunning,
            order=order,
        )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        assert count == 1

    async def test_excludes_legacy_null_trigger_rows(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        # Historical rows that predate the trigger column have NULL trigger
        # and are excluded from the count — slightly more lenient on legacy
        # data, which is the safer default for customers.
        order = await create_order(save_fixture, product=product, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=None,
            order=order,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        assert count == 1

    async def test_full_dunning_scenario_does_not_revoke(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        product: Product,
    ) -> None:
        """Regression: a customer was previously revoked within an hour of
        their first failure because manual portal retries inflated the
        count. The full sequence below produces 5 failed Payment rows but
        only 2 of them should count (purchase + retry_dunning), keeping the
        subscription safely below the 4-retry ceiling.
        """
        order = await create_order(save_fixture, product=product, customer=customer)
        # 1. Original auto renewal fails.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.purchase,
            order=order,
        )
        # 2. Customer updates card → auto recovery retry fails.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_payment_method_update,
            order=order,
        )
        # 3 & 4. Customer rapid-clicks Retry from the portal twice.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_customer,
            order=order,
        )
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_customer,
            order=order,
        )
        # 5. Hourly dunning cron fires another auto retry, also fails.
        await create_payment(
            save_fixture,
            organization,
            status=PaymentStatus.failed,
            trigger=PaymentTrigger.retry_dunning,
            order=order,
        )

        repository = PaymentRepository.from_session(session)
        count = await repository.count_failed_payments_for_order(order.id)

        # Only the original purchase + the cron-fired retry_dunning count.
        # 2 < 4 (len of DUNNING_RETRY_INTERVALS), so the subscription stays
        # in dunning instead of being revoked.
        assert count == 2
