from collections import namedtuple
from typing import Any
from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient, Response
from pytest_mock import MockerFixture

from polar.integrations.stripe.service import StripeService
from polar.models import (
    Customer,
    ExternalOrganization,
    Issue,
    Order,
    Pledge,
    Product,
    Refund,
    Repository,
    Transaction,
)
from polar.models.order import OrderStatus
from polar.models.pledge import PledgeState
from polar.models.refund import RefundReason, RefundStatus
from polar.order.service import order as order_service
from polar.pledge.service import pledge as pledge_service
from polar.postgres import AsyncSession
from polar.refund.schemas import RefundCreate
from polar.refund.service import refund as refund_service
from polar.transaction.service.refund import (
    refund_transaction as refund_transaction_service,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order_and_payment,
    create_payment_transaction,
    create_pledge,
    create_user,
)
from tests.fixtures.stripe import build_stripe_refund


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.refund.service.stripe_service", new=mock)
    return mock


Hooks = namedtuple("Hooks", "created updated succeeded")
HookNames = frozenset(Hooks._fields)


@pytest.fixture
def refund_hooks(mocker: MockerFixture) -> Hooks:
    created = mocker.patch.object(refund_service, "_after_created")
    updated = mocker.patch.object(refund_service, "_after_updated")
    succeeded = mocker.patch.object(refund_service, "_after_succeeded")
    return Hooks(
        created=created,
        updated=updated,
        succeeded=succeeded,
    )


def assert_hooks_called_once(refund_hooks: Hooks, called: set[str]) -> None:
    for hook in called:
        getattr(refund_hooks, hook).assert_called_once()

    not_called = HookNames - called
    for hook in not_called:
        getattr(refund_hooks, hook).assert_not_called()


def reset_hooks(refund_hooks: Hooks) -> None:
    for hook in HookNames:
        getattr(refund_hooks, hook).reset_mock()


class StripeRefund:
    async def calculate_and_create(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
    ) -> Response:
        refund_amount = create_schema.amount
        refund_tax_amount = refund_service.calculate_tax(order, refund_amount)
        return await self.create(
            client,
            stripe_service_mock,
            order,
            payment,
            create_schema,
            refund_amount=refund_amount,
            refund_tax_amount=refund_tax_amount,
        )

    async def create(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
        *,
        refund_amount: int,
        refund_tax_amount: int,
    ) -> Response:
        if not payment.charge_id:
            raise RuntimeError()

        stripe_refund = build_stripe_refund(
            amount=(refund_amount + refund_tax_amount),
            charge_id=payment.charge_id,
        )
        stripe_service_mock.create_refund.return_value = stripe_refund
        response = await client.post(
            "/v1/refunds/",
            json={
                "order_id": str(create_schema.order_id),
                "reason": str(create_schema.reason),
                "amount": refund_amount,
            },
        )
        return response

    async def create_and_assert(
        self,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        create_schema: RefundCreate,
        expected: dict[str, Any] = {},
        expected_status: int = 200,
    ) -> Response:
        response = await self.calculate_and_create(
            client,
            stripe_service_mock,
            order,
            payment,
            create_schema,
        )

        # TODO: Why 200 vs. 201?
        assert response.status_code == expected_status
        if not expected:
            return response

        data = response.json()
        for k, v in expected.items():
            assert data[k] == v

        return response

    async def create_order_refund(
        self,
        session: AsyncSession,
        client: AsyncClient,
        stripe_service_mock: MagicMock,
        order: Order,
        payment: Transaction,
        *,
        amount: int,
        tax: int,
    ) -> tuple[Order, Response]:
        refunded_amount = order.refunded_amount
        refunded_tax_amount = order.refunded_tax_amount

        response = await self.create_and_assert(
            client,
            stripe_service_mock,
            order,
            payment,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=amount,
                comment=None,
                revoke_benefits=False,
            ),
            expected={
                "status": "succeeded",
                "reason": "service_disruption",
                "amount": amount,
                # Refunds round down to closest cent (conservative in aggregate)
                "tax_amount": tax,
            },
        )
        refunded_amount += amount
        refunded_tax_amount += tax

        updated = await order_service.get(session, order.id)
        if not updated:
            raise RuntimeError()

        assert updated.refunded_amount == refunded_amount
        assert updated.refunded_tax_amount == refunded_tax_amount
        return updated, response

    async def assert_transaction_amounts_from_response(
        self, session: AsyncSession, response: Response
    ) -> Transaction:
        refund_id = response.json()["id"]
        refund = await refund_service.get(session, refund_id)
        assert refund
        return await self.assert_transaction_amounts_from_refund(session, refund)

    async def assert_transaction_amounts_from_refund(
        self, session: AsyncSession, refund: Refund
    ) -> Transaction:
        refund_transaction = await refund_transaction_service.get_by_refund_id(
            session, refund.processor_id
        )
        assert refund_transaction
        assert refund_transaction.amount == -1 * refund.amount
        assert refund_transaction.tax_amount == -1 * refund.tax_amount
        assert refund_transaction.account_amount == -1 * refund.amount
        return refund_transaction


@pytest.mark.asyncio
class TestCreatedWebhooks(StripeRefund):
    async def test_valid_pledge_refund(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        external_organization_linked: ExternalOrganization,
        repository_linked: Repository,
        issue_linked: Issue,
        pledge_by_user: Pledge,
        refund_hooks: Hooks,
    ) -> None:
        user = await create_user(save_fixture)
        payment_intent = "pi_pledge_payment_1337"
        pledge = await create_pledge(
            save_fixture,
            external_organization_linked,
            repository_linked,
            issue_linked,
            pledging_user=user,
            payment_id=payment_intent,
        )
        payment_transaction = await create_payment_transaction(
            save_fixture,
            amount=pledge.amount,
            tax_amount=0,
            pledge=pledge,
        )
        create_refund_transaction = mocker.patch.object(
            refund_transaction_service, "create"
        )

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=pledge.amount,
            charge_id=payment_transaction.charge_id,
            payment_intent=payment_intent,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert create_refund_transaction.call_count == 1

        # Only call webhooks on orders
        assert_hooks_called_once(refund_hooks, set())

        updated = await pledge_service.get_by_payment_id(
            session, payment_id=payment_intent
        )
        assert updated
        assert updated.state == PledgeState.refunded

    async def test_valid_pending(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product_organization_second: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            amount=1000,
            tax_amount=250,
        )

        create_refund_transaction = mocker.patch.object(
            refund_transaction_service, "create"
        )

        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="pending",
            amount=100,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.pending
        assert create_refund_transaction.call_count == 0
        assert_hooks_called_once(refund_hooks, {"created"})

        order = await order_service.get(session, order.id)  # type: ignore
        assert order
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

    async def test_valid_full_refund(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=1000,
            tax_amount=250,
        )
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=1250,
            charge_id=payment.charge_id,
        )
        # Could be created from our API
        refund = await refund_service._create_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert_hooks_called_once(refund_hooks, {"created"})
        await self.assert_transaction_amounts_from_refund(session, refund)

        order = await order_service.get(session, order.id)  # type: ignore
        assert order
        assert order.status == OrderStatus.refunded
        assert order.refunded_amount == 1000
        assert order.refunded_tax_amount == 250


@pytest.mark.asyncio
class TestUpdatedWebhooks(StripeRefund):
    async def test_valid(
        self,
        session: AsyncSession,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        product_organization_second: Product,
        refund_hooks: Hooks,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment = await create_order_and_payment(
            save_fixture,
            product=product_organization_second,
            customer=customer,
            amount=1000,
            tax_amount=250,
        )

        create_refund_transaction = mocker.patch.object(
            refund_transaction_service, "create"
        )

        refund_id = "re_stripe_refund_1337"
        stripe_refund = build_stripe_refund(
            status="pending",
            amount=100,
            id=refund_id,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.pending
        assert create_refund_transaction.call_count == 0
        assert_hooks_called_once(refund_hooks, {"created"})
        reset_hooks(refund_hooks)

        order = await order_service.get(session, order.id)  # type: ignore
        assert order
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 0

        stripe_refund = build_stripe_refund(
            status="succeeded",
            amount=100,
            id=refund_id,
            charge_id=payment.charge_id,
        )
        refund = await refund_service.upsert_from_stripe(session, stripe_refund)
        assert refund
        assert refund.status == RefundStatus.succeeded
        assert create_refund_transaction.call_count == 1
        assert_hooks_called_once(refund_hooks, {"updated"})

        order = await order_service.get(session, order.id)  # type: ignore
        assert order
        assert order.refunded_amount == 80
        assert order.refunded_tax_amount == 20
