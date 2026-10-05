from datetime import timedelta
from uuid import UUID

import pytest

from polar.kit.utils import utc_now
from polar.models import Customer, Organization
from polar.models.order import OrderStatus
from polar.models.payment import PaymentStatus
from polar.order.repository import OrderRepository
from polar.order.tasks import process_stale_payment_lock
from polar.postgres import AsyncSession
from scripts.backfill_sepa_payment_locks import backfill_statement, candidate_statement
from scripts.helper import run_batched_update
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_order, create_payment


@pytest.mark.asyncio
class TestBackfillSepaPaymentLocks:
    @pytest.mark.parametrize("order_status", [OrderStatus.pending, OrderStatus.paid])
    async def test_restores_missing_lock_and_is_idempotent(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        order_status: OrderStatus,
    ) -> None:
        next_attempt = utc_now() - timedelta(days=2)
        order = await create_order(
            save_fixture,
            customer=customer,
            status=order_status,
            next_payment_attempt_at=next_attempt,
        )
        await create_payment(
            save_fixture,
            organization,
            order=order,
            method="sepa_debit",
            status=PaymentStatus.pending,
        )
        modified_at = order.modified_at
        assert list(await session.scalars(candidate_statement())) == [order.id]
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

        assert (
            await run_batched_update(
                backfill_statement(), batch_size=1, sleep_seconds=0, session=session
            )
            == 1
        )
        await session.refresh(order)
        acquired_at = order.payment_lock_acquired_at
        assert acquired_at is not None
        assert order.next_payment_attempt_at == next_attempt
        assert order.modified_at == modified_at

        assert (
            await run_batched_update(
                backfill_statement(), batch_size=1, sleep_seconds=0, session=session
            )
            == 0
        )
        await session.refresh(order)
        assert order.payment_lock_acquired_at == acquired_at

    @pytest.mark.parametrize(
        ("latest_method", "latest_status", "expected"),
        [
            ("sepa_debit", PaymentStatus.pending, 1),
            ("sepa_debit", PaymentStatus.failed, 0),
            ("sepa_debit", PaymentStatus.succeeded, 0),
            ("card", PaymentStatus.pending, 0),
            ("card", PaymentStatus.failed, 0),
        ],
    )
    async def test_uses_latest_payment_across_all_methods_and_statuses(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        latest_method: str,
        latest_status: PaymentStatus,
        expected: int,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        older = await create_payment(
            save_fixture,
            organization,
            order=order,
            method="sepa_debit",
            status=PaymentStatus.pending,
        )
        older.created_at = utc_now() - timedelta(days=2)
        await save_fixture(older)
        await create_payment(
            save_fixture,
            organization,
            order=order,
            method=latest_method,
            status=latest_status,
        )

        assert (
            await run_batched_update(
                backfill_statement(), sleep_seconds=0, session=session
            )
            == expected
        )
        await session.refresh(order)
        assert (order.payment_lock_acquired_at is not None) == bool(expected)

    @pytest.mark.parametrize("higher_id_pending", [False, True])
    async def test_timestamp_ties_use_payment_id(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        higher_id_pending: bool,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        created_at = utc_now() - timedelta(days=1)
        for i in (1, 2):
            payment = await create_payment(
                save_fixture,
                organization,
                order=order,
                method="sepa_debit",
                status=(
                    PaymentStatus.pending
                    if (i == 2) == higher_id_pending
                    else PaymentStatus.failed
                ),
            )
            payment.id = UUID(int=i)
            payment.created_at = created_at
            await save_fixture(payment)

        assert await run_batched_update(
            backfill_statement(), sleep_seconds=0, session=session
        ) == int(higher_id_pending)

    @pytest.mark.parametrize(
        "skip_reason", ["locked", "deleted_order", "deleted_payment", "no_payment"]
    )
    async def test_skips_ineligible_orders(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        skip_reason: str,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        if skip_reason == "locked":
            order.payment_lock_acquired_at = utc_now() - timedelta(days=3)
        if skip_reason == "deleted_order":
            order.deleted_at = utc_now()
        await save_fixture(order)
        acquired_at = order.payment_lock_acquired_at
        if skip_reason != "no_payment":
            payment = await create_payment(
                save_fixture,
                organization,
                order=order,
                method="sepa_debit",
                status=PaymentStatus.pending,
            )
            if skip_reason == "deleted_payment":
                payment.deleted_at = utc_now()
                await save_fixture(payment)

        assert (
            await run_batched_update(
                backfill_statement(), sleep_seconds=0, session=session
            )
            == 0
        )
        await session.refresh(order)
        assert order.payment_lock_acquired_at == acquired_at

    async def test_rechecks_status_after_preview(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        payment = await create_payment(
            save_fixture,
            organization,
            order=order,
            method="sepa_debit",
            status=PaymentStatus.pending,
        )
        assert list(await session.scalars(candidate_statement())) == [order.id]
        payment.status = PaymentStatus.failed
        await save_fixture(payment)

        assert (
            await run_batched_update(
                backfill_statement(), sleep_seconds=0, session=session
            )
            == 0
        )
        await session.refresh(order)
        assert order.payment_lock_acquired_at is None

    async def test_updates_all_batches(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        orders = [await create_order(save_fixture, customer=customer) for _ in range(5)]
        for order in orders:
            await create_payment(
                save_fixture,
                organization,
                order=order,
                method="sepa_debit",
                status=PaymentStatus.pending,
            )

        assert (
            await run_batched_update(
                backfill_statement(), batch_size=2, sleep_seconds=0, session=session
            )
            == 5
        )
        assert list(await session.scalars(candidate_statement())) == []

    async def test_restored_lock_survives_stale_cleanup(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        await create_payment(
            save_fixture,
            organization,
            order=order,
            method="sepa_debit",
            status=PaymentStatus.pending,
        )
        assert (
            await run_batched_update(
                backfill_statement(), sleep_seconds=0, session=session
            )
            == 1
        )
        await session.refresh(order)
        assert order.payment_lock_acquired_at is not None
        acquired_at = utc_now() - timedelta(days=3)
        order.payment_lock_acquired_at = acquired_at
        await save_fixture(order)

        await process_stale_payment_lock(order.id)

        refreshed = await OrderRepository.from_session(session).get_by_id(order.id)
        assert refreshed is not None
        assert refreshed.payment_lock_acquired_at == acquired_at

    @pytest.mark.parametrize("deleted_newer_payment", [False, True])
    async def test_latest_non_deleted_payment_after_failure(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        organization: Organization,
        deleted_newer_payment: bool,
    ) -> None:
        order = await create_order(save_fixture, customer=customer)
        failed = await create_payment(
            save_fixture, organization, order=order, status=PaymentStatus.failed
        )
        failed.created_at = utc_now() - timedelta(days=3)
        await save_fixture(failed)
        pending = await create_payment(
            save_fixture,
            organization,
            order=order,
            method="sepa_debit",
            status=PaymentStatus.pending,
        )
        pending.created_at = utc_now() - timedelta(days=2)
        await save_fixture(pending)
        if deleted_newer_payment:
            newer = await create_payment(
                save_fixture, organization, order=order, status=PaymentStatus.failed
            )
            newer.deleted_at = utc_now()
            await save_fixture(newer)

        assert (
            await run_batched_update(
                backfill_statement(), sleep_seconds=0, session=session
            )
            == 1
        )
