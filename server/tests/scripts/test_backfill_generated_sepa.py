from unittest.mock import MagicMock

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.enums import PaymentMode
from polar.kit.utils import utc_now
from polar.models import Customer, Product
from polar.models.order import OrderStatus
from polar.models.payment import PaymentTrigger
from polar.payment_method.repository import PaymentMethodRepository
from polar.postgres import AsyncSession
from scripts.backfill_generated_sepa import backfill_method, recover_order
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment_method,
    create_subscription,
)


@pytest.mark.asyncio
class TestBackfillMethod:
    @pytest.mark.parametrize("source_type", ["charge", "setup_attempt"])
    @pytest.mark.parametrize("execute", [False, True])
    async def test_replaces_only_matching_references(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
        source_type: str,
        execute: bool,
    ) -> None:
        original = await create_payment_method(save_fixture, customer, type="ideal")
        existing = await create_payment_method(
            save_fixture, customer, type="sepa_debit", processor_id="pm_generated"
        )
        card = await create_payment_method(save_fixture, customer)
        customer.default_payment_method = original
        await save_fixture(customer)
        affected = await create_subscription(
            save_fixture, product=product, customer=customer, payment_method=original
        )
        unaffected = await create_subscription(
            save_fixture, product=product, customer=customer, payment_method=card
        )
        generated = stripe_lib.PaymentMethod.construct_from(
            {
                "id": existing.processor_id,
                "type": "sepa_debit",
                "customer": customer.stripe_customer_id,
                "sepa_debit": {
                    "last4": "1234",
                    "generated_from": {
                        "charge": None,
                        "setup_attempt": None,
                        source_type: {
                            "object": source_type,
                            "id": "source_test",
                            "payment_method": original.processor_id,
                            "customer": customer.stripe_customer_id,
                        },
                    },
                },
            },
            None,
        )
        methods = MagicMock()
        methods.__aiter__.return_value = [generated]
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.list_payment_methods",
            return_value=methods,
        )
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_lib.PaymentMethod.retrieve_async",
            return_value=generated,
        )
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.get_payment_method",
            return_value=stripe_lib.PaymentMethod.construct_from(
                {
                    "id": existing.processor_id,
                    "type": "sepa_debit",
                    "customer": customer.stripe_customer_id,
                    "sepa_debit": {
                        "last4": "1234",
                        "generated_from": {source_type: "source_test"},
                    },
                },
                None,
            ),
        )

        assert await backfill_method(session, original, execute=execute)
        await session.flush()
        await session.refresh(customer)
        await session.refresh(affected)
        await session.refresh(unaffected)
        assert customer.default_payment_method_id == (
            existing.id if execute else original.id
        )
        assert affected.payment_method_id == (existing.id if execute else original.id)
        assert unaffected.payment_method_id == card.id
        assert (original.deleted_at is not None) == execute
        saved = await PaymentMethodRepository.from_session(session).get_by_id(
            original.id
        )
        assert saved is (None if execute else original)

    @pytest.mark.parametrize("mismatch", ["source", "customer", "ambiguous"])
    async def test_skips_unverified_mapping(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        mocker: MockerFixture,
        mismatch: str,
    ) -> None:
        original = await create_payment_method(save_fixture, customer, type="ideal")
        generated = stripe_lib.PaymentMethod.construct_from(
            {
                "id": "pm_generated",
                "type": "sepa_debit",
                "customer": customer.stripe_customer_id,
                "sepa_debit": {
                    "generated_from": {
                        "setup_attempt": None,
                        "charge": {
                            "object": "charge",
                            "id": "ch_test",
                            "payment_method": "pm_other"
                            if mismatch == "source"
                            else original.processor_id,
                            "customer": "cus_other"
                            if mismatch == "customer"
                            else customer.stripe_customer_id,
                        },
                    }
                },
            },
            None,
        )
        methods = MagicMock()
        methods.__aiter__.return_value = (
            [generated, generated] if mismatch == "ambiguous" else [generated]
        )
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.list_payment_methods",
            return_value=methods,
        )
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_lib.PaymentMethod.retrieve_async",
            return_value=generated,
        )
        assert not await backfill_method(session, original, execute=True)
        assert original.deleted_at is None


@pytest.mark.asyncio
class TestRecoverOrder:
    @pytest.mark.parametrize(
        ("status", "execute", "locked", "already_attempted"),
        [
            ("succeeded", True, False, False),
            ("processing", True, False, False),
            ("requires_action", True, False, False),
            ("requires_payment_method", True, False, False),
            ("requires_payment_method", False, False, False),
            ("requires_payment_method", True, True, False),
            ("requires_payment_method", True, False, True),
        ],
    )
    async def test_reconciles_before_retrying(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        customer: Customer,
        product: Product,
        mocker: MockerFixture,
        status: str,
        execute: bool,
        locked: bool,
        already_attempted: bool,
    ) -> None:
        method = await create_payment_method(save_fixture, customer, type="sepa_debit")
        subscription = await create_subscription(
            save_fixture, product=product, customer=customer, payment_method=method
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.pending,
            payment_lock_acquired_at=utc_now() if locked else None,
        )
        intent = stripe_lib.PaymentIntent.construct_from(
            {
                "id": "pi_existing",
                "status": status,
                "latest_charge": "ch_existing",
                "payment_method": method.processor_id
                if already_attempted
                else "pm_original",
                "amount_received": order.due_amount,
                "currency": order.currency,
                "metadata": {"order_id": str(order.id)},
            },
            None,
        )
        intents = MagicMock()
        intents.auto_paging_iter.return_value.__aiter__.return_value = [intent]
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_lib.PaymentIntent.list_async",
            return_value=intents,
        )
        cancel = mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.cancel_payment_intent"
        )
        mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.get_payment_method",
            return_value=stripe_lib.PaymentMethod.construct_from(
                {
                    "id": method.processor_id,
                    "type": "sepa_debit",
                    "customer": customer.stripe_customer_id,
                },
                None,
            ),
        )
        get_charge = mocker.patch(
            "scripts.backfill_generated_sepa.stripe_service.get_charge"
        )
        reconcile = mocker.patch(
            "scripts.backfill_generated_sepa.stripe_payment.handle_success"
        )
        trigger = mocker.patch(
            "scripts.backfill_generated_sepa.order_service.trigger_payment",
            return_value=None,
        )

        await recover_order(session, order, execute=execute, retry=True)

        if status == "succeeded":
            reconcile.assert_awaited_once_with(session, get_charge.return_value)
            trigger.assert_not_awaited()
            cancel.assert_not_awaited()
        elif (
            status == "requires_payment_method"
            and execute
            and not locked
            and not already_attempted
        ):
            cancel.assert_awaited_once_with(intent.id)
            trigger.assert_awaited_once_with(
                session,
                order,
                method,
                payment_mode=PaymentMode.sync,
                payment_trigger=PaymentTrigger.retry_payment_method_update,
            )
            reconcile.assert_not_awaited()
        else:
            trigger.assert_not_awaited()
            cancel.assert_not_awaited()
            reconcile.assert_not_awaited()
