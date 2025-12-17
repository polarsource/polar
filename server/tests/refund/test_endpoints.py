from unittest.mock import MagicMock

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture

from polar.auth.scope import Scope
from polar.benefit.grant.service import benefit_grant as benefit_grant_service
from polar.integrations.stripe.service import StripeService
from polar.kit.utils import generate_uuid
from polar.models import (
    Customer,
    Order,
    Organization,
    Payment,
    Product,
    Subscription,
    Transaction,
    UserOrganization,
)
from polar.models.dispute import DisputeStatus
from polar.models.order import OrderStatus
from polar.models.refund import RefundReason, RefundStatus
from polar.models.subscription import SubscriptionStatus
from polar.order.repository import OrderRepository
from polar.postgres import AsyncSession
from polar.refund.schemas import RefundCreate
from tests.fixtures import random_objects as ro
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.stripe import build_stripe_refund

from .test_service import StripeRefund


@pytest.fixture(autouse=True)
def stripe_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = MagicMock(spec=StripeService)
    mocker.patch("polar.refund.service.stripe_service", new=mock)
    return mock


@pytest.fixture(autouse=True)
def refund_transaction_service_mock(mocker: MockerFixture) -> MagicMock:
    mock = mocker.patch(
        "polar.refund.service.refund_transaction_service", autospec=True
    )
    return mock


async def create_order_and_payment(
    save_fixture: SaveFixture,
    *,
    product: Product,
    customer: Customer,
    amount: int,
    tax_amount: int,
    subscription: Subscription | None = None,
) -> tuple[Order, Payment, Transaction]:
    order = await ro.create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=amount,
        tax_amount=tax_amount,
        subscription=subscription,
    )
    payment = await ro.create_payment(
        save_fixture, product.organization, amount=amount + tax_amount, order=order
    )
    transaction = await ro.create_payment_transaction(
        save_fixture,
        amount=amount,
        tax_amount=tax_amount,
        order=order,
        charge_id=payment.processor_id,
    )
    return order, payment, transaction


@pytest.mark.asyncio
class TestListRefunds(StripeRefund):
    async def seed_refunds(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        product_organization_second: Product,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
        customer_second: Customer,
        customer_organization_second: Customer,
    ) -> tuple[Order, Order, Order]:
        order, payment, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=1000,
            tax_amount=250,
        )
        order_second, payment_second, _ = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=1000,
            tax_amount=250,
        )
        order_second_org, payment_second_org, _ = await create_order_and_payment(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
            amount=1000,
            tax_amount=250,
        )

        def refund_id() -> str:
            id = generate_uuid()
            return f"re_{id}"

        # First order
        await ro.create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.pending,
            amount=80,
            tax_amount=20,
            processor_id=refund_id(),
        )
        await ro.create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=80,
            tax_amount=20,
            processor_id=refund_id(),
        )
        await ro.create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=160,
            tax_amount=40,
            processor_id=refund_id(),
        )
        await ro.create_refund(
            save_fixture,
            order,
            payment,
            status=RefundStatus.succeeded,
            amount=160,
            tax_amount=40,
            processor_id=refund_id(),
        )
        # Second order
        await ro.create_refund(
            save_fixture,
            order_second,
            payment_second,
            status=RefundStatus.succeeded,
            amount=240,
            tax_amount=60,
            processor_id=refund_id(),
        )
        await ro.create_refund(
            save_fixture,
            order_second,
            payment_second,
            status=RefundStatus.succeeded,
            amount=240,
            tax_amount=60,
            processor_id=refund_id(),
        )
        dispute = await ro.create_dispute(
            save_fixture,
            order=order_second,
            payment=payment_second,
            status=DisputeStatus.prevented,
        )
        await ro.create_refund(
            save_fixture,
            order_second,
            payment_second,
            status=RefundStatus.succeeded,
            reason=RefundReason.dispute_prevention,
            amount=240,
            tax_amount=60,
            processor_id=refund_id(),
            dispute=dispute,
        )

        # Second organization order
        await ro.create_refund(
            save_fixture,
            order_second_org,
            payment_second_org,
            status=RefundStatus.succeeded,
            amount=1000,
            tax_amount=250,
            processor_id=refund_id(),
        )

        return order, order_second, order_second_org

    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.get("/v1/refunds/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        product_organization_second: Product,
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
        customer_second: Customer,
        customer_organization_second: Customer,
    ) -> None:
        order, order_second, _ = await self.seed_refunds(
            session,
            save_fixture,
            client,
            organization,
            user_organization,
            product_organization_second,
            stripe_service_mock,
            product,
            customer,
            customer_second,
            customer_organization_second,
        )

        # Get all for organization
        response = await client.get("/v1/refunds/")
        json = response.json()
        assert json["pagination"]["total_count"] == 7

        # Get all succeeded for first order
        response = await client.get(
            "/v1/refunds/",
            params={
                "order_id": str(order.id),
                "succeeded": True,
            },
        )
        json = response.json()
        assert json["pagination"]["total_count"] == 3

        # Get non-succeeded refunds
        response = await client.get(
            "/v1/refunds/",
            params={
                "succeeded": False,
            },
        )
        json = response.json()
        assert json["pagination"]["total_count"] == 1

        # Get all for first order regardless of status
        response = await client.get(
            "/v1/refunds/",
            params={
                "order_id": str(order.id),
            },
        )
        json = response.json()
        assert json["pagination"]["total_count"] == 4

        # Get all for second order
        response = await client.get(
            "/v1/refunds/",
            params={
                "order_id": str(order_second.id),
                "succeeded": True,
            },
        )
        json = response.json()
        assert json["pagination"]["total_count"] == 3


@pytest.mark.asyncio
class TestCreateRefunds(StripeRefund):
    async def test_anonymous(
        self, client: AsyncClient, organization: Organization
    ) -> None:
        response = await client.post("/v1/refunds/")
        assert response.status_code == 401

    @pytest.mark.auth
    async def test_tampered(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        product_organization_second: Product,
        stripe_service_mock: MagicMock,
        product: Product,
        customer_organization_second: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment, transaction = await create_order_and_payment(
            save_fixture,
            product=product_organization_second,
            customer=customer_organization_second,
            amount=1000,
            tax_amount=250,
        )

        response = await self.create(
            client,
            stripe_service_mock,
            order,
            transaction,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=500,
                comment=None,
                revoke_benefits=False,
            ),
            refund_amount=500,
            refund_tax_amount=125,
        )
        assert response.status_code == 422

        order_repository = OrderRepository.from_session(session)
        updated = await order_repository.get_by_id(order.id)
        assert updated is not None

        assert updated.status == OrderStatus.paid
        assert updated.refunded_amount == 0
        assert updated.refunded_tax_amount == 0

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.refunds_write}),
    )
    async def test_valid_partial_to_full(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        # Complex Swedish order. $99.9 with 25% VAT = $24.75
        order, payment, transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=9_990,
            # Rounded up from 2_497.5. Stripe rounds cents too.
            # Required and expected by tax authorities, e.g Sweden.
            tax_amount=2_498,
        )

        order, response = await self.create_order_refund(
            session,
            client,
            stripe_service_mock,
            order,
            transaction,
            amount=1110,
            # Rounded up from 277.5
            tax=278,
        )
        assert order.status == OrderStatus.partially_refunded

        # 8_880 remaining
        order, response = await self.create_order_refund(
            session,
            client,
            stripe_service_mock,
            order,
            transaction,
            amount=993,
            # Rounded down from 248.25
            tax=248,
        )
        assert order.status == OrderStatus.partially_refunded

        # 7_887 remaining
        order, response = await self.create_order_refund(
            session,
            client,
            stripe_service_mock,
            order,
            transaction,
            amount=5887,
            # Rounds up from 1471.75
            tax=1472,
        )
        assert order.status == OrderStatus.partially_refunded

        # 2_000 remaining
        amount_before_exceed_attempt = order.refunded_amount
        tax_before_exceed_attempt = order.refunded_tax_amount
        response = await self.create(
            client,
            stripe_service_mock,
            order,
            transaction,
            RefundCreate(
                order_id=order.id,
                reason=RefundReason.service_disruption,
                amount=2001,
                comment=None,
                revoke_benefits=False,
            ),
            refund_amount=2001,
            # Rounds down from 500.25
            refund_tax_amount=500,
        )
        assert response.status_code == 422

        order_repository = OrderRepository.from_session(session)
        updated = await order_repository.get_by_id(order.id)
        assert updated is not None
        assert updated.refunded_amount == amount_before_exceed_attempt
        assert updated.refunded_tax_amount == tax_before_exceed_attempt
        assert updated.refundable_amount == 2000

        # Still 2_000 remaining
        order, response = await self.create_order_refund(
            session,
            client,
            stripe_service_mock,
            order,
            transaction,
            amount=2000,
            tax=order.tax_amount - order.refunded_tax_amount,
        )
        assert order.status == OrderStatus.refunded
        assert order.refunded

    @pytest.mark.auth(
        AuthSubjectFixture(scopes={Scope.web_write}),
        AuthSubjectFixture(scopes={Scope.refunds_write}),
    )
    async def test_valid_full_refund(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        order_amount = 2000
        order_tax_amount = 500
        order, payment, transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=order_amount,
            tax_amount=order_tax_amount,
        )

        assert not order.refunded
        assert order.status == OrderStatus.paid

        order, response = await self.create_order_refund(
            session,
            client,
            stripe_service_mock,
            order,
            transaction,
            amount=order_amount,
            tax=order_tax_amount,
        )
        assert order.status == OrderStatus.refunded
        assert order.refunded_amount == order_amount
        assert order.refunded_tax_amount == order_tax_amount
        assert order.refunded


@pytest.mark.asyncio
class TestCreateRefundsAndRevokeBenefits(StripeRefund):
    @pytest.mark.auth
    async def test_disallow_subscriptions(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await ro.create_subscription(
            save_fixture,
            product=product,
            status=SubscriptionStatus.active,
            customer=customer,
        )
        order, payment, transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            amount=1000,
            tax_amount=250,
        )
        enqueue_revoke_benefits = mocker.patch.object(
            benefit_grant_service, "enqueue_benefits_grants"
        )
        # Get all for second order
        response = await client.post(
            "/v1/refunds/",
            json={
                "order_id": str(order.id),
                "amount": 100,
                "reason": "customer_request",
                "revoke_benefits": True,
            },
        )
        assert response.status_code == 400
        assert enqueue_revoke_benefits.call_count == 0

    @pytest.mark.auth
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        mocker: MockerFixture,
        client: AsyncClient,
        organization: Organization,
        user_organization: UserOrganization,  # makes User a member of Organization
        stripe_service_mock: MagicMock,
        product: Product,
        customer: Customer,
    ) -> None:
        order, payment, transaction = await create_order_and_payment(
            save_fixture,
            product=product,
            customer=customer,
            amount=1000,
            tax_amount=250,
            subscription=None,
        )
        enqueue_revoke_benefits = mocker.patch.object(
            benefit_grant_service, "enqueue_benefits_grants"
        )

        stripe_refund = build_stripe_refund(
            amount=125,
            charge_id=payment.processor_id,
        )
        stripe_service_mock.create_refund.return_value = stripe_refund
        # Get all for second order
        response = await client.post(
            "/v1/refunds/",
            json={
                "order_id": str(order.id),
                "amount": 100,
                "reason": "customer_request",
                "revoke_benefits": True,
            },
        )
        assert response.status_code == 200
        assert enqueue_revoke_benefits.call_count == 1
        revoked_with = enqueue_revoke_benefits.call_args.kwargs
        assert revoked_with["task"] == "revoke"
        assert revoked_with["customer"].id == customer.id
        assert revoked_with["product"].id == product.id
        assert revoked_with["order"].id == order.id

        data = response.json()
        assert data["revoke_benefits"]
