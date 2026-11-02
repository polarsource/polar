from datetime import timedelta

import pytest
from freezegun import freeze_time

from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.checkout import CheckoutStatus
from polar.models.payment import PaymentStatus
from polar.observability.invariants.rules import INVARIANTS
from polar.observability.invariants.rules.checkouts_stuck_after_payment import (
    CheckoutsStuckAfterPaymentInvariant,
    CheckoutsStuckAfterPaymentInvariantError,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_checkout, create_payment


@pytest.mark.anyio
@freeze_time("2026-11-02 12:00:00")
class TestCheck:
    @pytest.mark.parametrize(
        "case",
        [
            "stuck",
            "recent_record",
            "record_at_grace_boundary",
            "record_updated_recently",
            "record_at_age_boundary",
            "old_record",
            "recent_payment",
            "payment_at_grace_boundary",
            "payment_updated_recently",
            "failed_payment",
            "pending_payment",
            "no_payment",
            "completed",
            "deleted_record",
            "deleted_payment",
        ],
    )
    async def test_eligibility(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        case: str,
    ) -> None:
        now = utc_now()
        old = now - timedelta(minutes=6)
        created_at = {
            "recent_record": now - timedelta(minutes=4),
            "record_at_grace_boundary": now - timedelta(minutes=5),
            "record_at_age_boundary": now - timedelta(days=7),
            "old_record": now - timedelta(days=8),
        }.get(case, old)
        record = await create_checkout(
            save_fixture,
            products=[product],
            customer=customer,
            status=CheckoutStatus.succeeded
            if case == "completed"
            else CheckoutStatus.confirmed,
            created_at=created_at,
        )
        if case in {"record_updated_recently", "deleted_record"}:
            record.modified_at = now if case == "record_updated_recently" else old
            record.deleted_at = old if case == "deleted_record" else None
            await save_fixture(record)

        if case != "no_payment":
            payment = await create_payment(
                save_fixture,
                product.organization,
                checkout=record,
                status={
                    "failed_payment": PaymentStatus.failed,
                    "pending_payment": PaymentStatus.pending,
                }.get(case, PaymentStatus.succeeded),
            )
            payment.created_at = {
                "recent_payment": now - timedelta(minutes=4),
                "payment_at_grace_boundary": now - timedelta(minutes=5),
            }.get(case, old)
            payment.modified_at = (
                now if case == "payment_updated_recently" else payment.created_at
            )
            payment.deleted_at = old if case == "deleted_payment" else None
            await save_fixture(payment)

        invariant = CheckoutsStuckAfterPaymentInvariant(session)
        assert type(invariant) in INVARIANTS
        if case == "stuck":
            with pytest.raises(CheckoutsStuckAfterPaymentInvariantError) as exc_info:
                await invariant.check()
            assert exc_info.value.context == {
                "count": 1,
                "checkouts": {"ids": [record.id], "has_more": False},
            }
        else:
            await invariant.check()

    async def test_limits_ids_without_counting_multiple_payments_twice(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        records = []
        for index in range(15):
            old = utc_now() - timedelta(minutes=6 + index)
            record = await create_checkout(
                save_fixture,
                products=[product],
                customer=customer,
                status=CheckoutStatus.confirmed,
                created_at=old,
            )
            for _ in range(2):
                payment = await create_payment(
                    save_fixture, product.organization, checkout=record
                )
                payment.created_at = old
                payment.modified_at = old
                await save_fixture(payment)
            records.append(record)

        with pytest.raises(CheckoutsStuckAfterPaymentInvariantError) as exc_info:
            await CheckoutsStuckAfterPaymentInvariant(session).check()

        assert exc_info.value.context == {
            "count": 15,
            "checkouts": {
                "ids": [record.id for record in reversed(records)][:10],
                "has_more": True,
            },
        }
