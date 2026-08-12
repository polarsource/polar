import pytest

from polar.kit.db.postgres import AsyncSession
from polar.models import Customer, Product, WalletTransaction
from polar.models.order import OrderStatus
from polar.wallet.service import wallet as wallet_service
from scripts.backfill_void_order_consumed_balance import run_backfill
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_wallet_billing,
    create_wallet_transaction,
)


@pytest.mark.asyncio
class TestBackfillVoidOrderConsumedBalance:
    async def test_restores_consumed_balance(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.void,
            subtotal_amount=3000,
            applied_balance_amount=-1000,
        )
        # Customer had 1000, consumed by the order at creation. The old void()
        # never gave it back, so the wallet sits at 0.
        wallet = await create_wallet_billing(
            save_fixture, customer=customer, initial_balance=1000
        )
        await create_wallet_transaction(save_fixture, wallet=wallet, amount=-1000)

        restored = await run_backfill(session, dry_run=False)

        assert restored == 1
        balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert balance == 1000

    async def test_dry_run_makes_no_changes(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.void,
            subtotal_amount=3000,
            applied_balance_amount=-1000,
        )
        wallet = await create_wallet_billing(
            save_fixture, customer=customer, initial_balance=1000
        )
        await create_wallet_transaction(save_fixture, wallet=wallet, amount=-1000)

        restored = await run_backfill(session, dry_run=True)

        assert restored == 1
        balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert balance == 0

    async def test_idempotent_when_restoration_exists(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        product: Product,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.void,
            subtotal_amount=3000,
            applied_balance_amount=-1000,
        )
        wallet = await create_wallet_billing(
            save_fixture, customer=customer, initial_balance=1000
        )
        await create_wallet_transaction(save_fixture, wallet=wallet, amount=-1000)
        # The fixed void() already restored the consumed balance for this order.
        restoration = WalletTransaction(
            wallet=wallet, amount=1000, currency=wallet.currency, order=order
        )
        await save_fixture(restoration)

        restored = await run_backfill(session, dry_run=False)

        assert restored == 0
        balance = await wallet_service.get_billing_wallet_balance(
            session, customer, order.currency
        )
        assert balance == 1000

    async def test_ignores_pending_and_non_negative_balance(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        customer: Customer,
        product: Product,
    ) -> None:
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=3000,
            applied_balance_amount=-1000,
        )
        await create_order(
            save_fixture,
            product=product,
            customer=customer,
            status=OrderStatus.void,
            subtotal_amount=3000,
            applied_balance_amount=0,
        )

        restored = await run_backfill(session, dry_run=False)

        assert restored == 0
