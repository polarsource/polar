from typing import TypedDict, cast
from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Customer,
    OrderItem,
    ProductPriceFixed,
    Subscription,
)
from polar.models.order import OrderStatus
from polar.models.organization import Organization
from polar.models.payment import PaymentStatus
from polar.order.service import order as order_service
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_order,
    create_payment,
    create_product,
)


@pytest.fixture
def enqueue_job_mock(mocker: MockerFixture) -> MagicMock:
    return mocker.patch("polar.order.service.enqueue_job")


class OrderFixture(TypedDict):
    items: list[
        tuple[
            str,
            int,  # amount
            bool,  # proration
        ]
    ]
    status: OrderStatus
    subtotal_amount: int
    discount_amount: int
    tax_amount: int


class BalanceFixture(TypedDict):
    products: dict[str, tuple[SubscriptionRecurringInterval, int]]
    orders: list[OrderFixture]
    payments: list[
        tuple[
            int,  # Order index
            int,  # amount
            PaymentStatus,
        ]
    ]
    expected_balance: int


@pytest.mark.parametrize(
    "setup",
    [
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-basic", -1500, True), ("p-pro", 4500, True)],
                        "status": OrderStatus.paid,
                        "subtotal_amount": 3000,
                        "discount_amount": 0,
                        "tax_amount": 0,
                    },
                ],
                "payments": [],
                "expected_balance": 3000,
            },
            id="no-payments-positive-balance",
        ),
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-pro", -4500, True), ("p-pro", 1500, True)],
                        "status": OrderStatus.paid,
                        "subtotal_amount": -3000,
                        "discount_amount": 0,
                        "tax_amount": 0,
                    },
                ],
                "payments": [],
                "expected_balance": -3000,
            },
            id="no-payments-negative-balance",
        ),
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-basic", -1500, True), ("p-pro", 4500, True)],
                        "status": OrderStatus.paid,
                        "subtotal_amount": 3000,
                        "discount_amount": 0,
                        "tax_amount": 3000 * 0.25,
                    },
                ],
                "payments": [(0, 3750, PaymentStatus.succeeded)],
                "expected_balance": 0,
            },
            id="tax",
        ),
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-basic", -1500, True), ("p-pro", 4500, True)],
                        "status": OrderStatus.paid,
                        "subtotal_amount": 3000,
                        "discount_amount": 500,
                        "tax_amount": (3000 - 500) * 0.25,
                    },
                ],
                "payments": [(0, 3125, PaymentStatus.succeeded)],
                "expected_balance": 0,
            },
            id="tax-with-discount",
        ),
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-basic", -1500, True), ("p-pro", 4500, True)],
                        "status": OrderStatus.paid,
                        "subtotal_amount": 3000,
                        "discount_amount": 0,
                        "tax_amount": 0,
                    },
                ],
                "payments": [(0, 3000, PaymentStatus.failed)],
                "expected_balance": 3000,
            },
            id="payment-failed",
        ),
        pytest.param(
            {
                "products": {
                    "p-basic": (SubscriptionRecurringInterval.month, 3000),
                    "p-pro": (SubscriptionRecurringInterval.month, 9000),
                },
                "orders": [
                    # Emulate a plan switch middle of month
                    {
                        "items": [("p-basic", -1500, True), ("p-pro", 4500, True)],
                        "status": OrderStatus.pending,
                        "subtotal_amount": 3000,
                        "discount_amount": 0,
                        "tax_amount": 0,
                    },
                ],
                "payments": [(0, 3000, PaymentStatus.failed)],
                "expected_balance": 0,
            },
            id="exclude-unpaid-orders",
        ),
    ],
)
@pytest.mark.asyncio
async def test_customer_balance(
    enqueue_job_mock: MagicMock,
    save_fixture: SaveFixture,
    session: AsyncSession,
    organization: Organization,
    subscription: Subscription,
    setup: BalanceFixture,
) -> None:
    customer = subscription.customer

    # Create products
    products = {}
    prices = {}
    for key, (recurring_interval, price_amount) in setup["products"].items():
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=recurring_interval,
            prices=[(price_amount,)],
        )
        products[key] = product

        price = cast(ProductPriceFixed, product.prices[0])
        prices[key] = price

    # Create orders
    orders = []
    for dict_order in setup["orders"]:
        order_items = []
        for t_order_item in dict_order["items"]:
            product_key, amount, proration = t_order_item
            product = products[product_key]
            order_item = OrderItem(
                label="",
                product_price=prices[product_key],
                amount=amount,
                tax_amount=0,
                proration=proration,
            )
            order_items.append(order_item)
        order = await create_order(
            save_fixture,
            product=products[product_key],
            status=dict_order["status"],
            customer=customer,
            order_items=order_items,
            subtotal_amount=dict_order["subtotal_amount"],
            discount_amount=dict_order["discount_amount"],
            tax_amount=dict_order["tax_amount"],
        )
        orders.append(order)

    # Create payments
    payments = []
    for order_idx, amount, status in setup["payments"]:
        order = orders[order_idx]
        payment = await create_payment(
            save_fixture,
            order.organization,
            status=status,
            order=order,
            amount=amount,
        )
        payments.append(payment)

    assert (
        await order_service.customer_balance(session, customer)
        == setup["expected_balance"]
    )
