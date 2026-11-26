import pytest

from polar.enums import TaxBehavior
from polar.models import Customer, OrderItem, Product
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.order import OrderStatus
from polar.models.product_price import (
    ProductPriceFixed,
    ProductPriceSeatUnit,
    ProductPriceUnit,
)
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_discount,
    create_order,
    create_product_price_seat_unit,
    create_subscription,
)


@pytest.mark.anyio
class TestIsPaymentRequired:
    async def test_positive_amount_due(
        self, save_fixture: SaveFixture, customer: Customer
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=1000,
        )

        assert order.is_payment_required

    async def test_balance_covers_amount_due(
        self, save_fixture: SaveFixture, customer: Customer
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            status=OrderStatus.pending,
            subtotal_amount=1000,
            applied_balance_amount=-1000,
        )

        assert not order.is_payment_required


@pytest.mark.anyio
class TestIsPaymentSetupRequired:
    async def test_one_time_order(
        self, save_fixture: SaveFixture, customer: Customer, product_one_time: Product
    ) -> None:
        order = await create_order(
            save_fixture, customer=customer, product=product_one_time
        )

        assert not order.is_payment_setup_required

    async def test_full_discount_for_first_period(
        self, save_fixture: SaveFixture, customer: Customer, product: Product
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        discount = await create_discount(
            save_fixture,
            organization=product.organization,
            type=DiscountType.percentage,
            duration=DiscountDuration.once,
            basis_points=10_000,
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.draft,
            subtotal_amount=1000,
            discount_amount=1000,
            discount=discount,
        )

        assert order.is_payment_setup_required

    async def test_full_discount_forever(
        self, save_fixture: SaveFixture, customer: Customer, product: Product
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product
        )
        discount = await create_discount(
            save_fixture,
            organization=product.organization,
            type=DiscountType.percentage,
            duration=DiscountDuration.forever,
            basis_points=10_000,
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.draft,
            subtotal_amount=1000,
            discount_amount=1000,
            discount=discount,
        )

        assert not order.is_payment_setup_required

    async def test_free_subscription(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        product_recurring_free_price: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product_recurring_free_price
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product_recurring_free_price,
            subscription=subscription,
            status=OrderStatus.draft,
            subtotal_amount=0,
        )

        assert not order.is_payment_setup_required

    async def test_subscription_with_free_first_seat(
        self, save_fixture: SaveFixture, customer: Customer, product: Product
    ) -> None:
        price = await create_product_price_seat_unit(
            save_fixture,
            product=product,
            tiers=[
                {"min_seats": 1, "max_seats": 1, "price_per_seat": 0},
                {"min_seats": 2, "max_seats": None, "price_per_seat": 1000},
            ],
        )
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product, prices=[price], seats=1
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product,
            subscription=subscription,
            status=OrderStatus.draft,
            subtotal_amount=0,
        )

        assert not order.is_payment_required
        assert order.is_payment_setup_required

    async def test_metered_subscription(
        self,
        save_fixture: SaveFixture,
        customer: Customer,
        product_recurring_metered: Product,
    ) -> None:
        subscription = await create_subscription(
            save_fixture, customer=customer, product=product_recurring_metered
        )
        order = await create_order(
            save_fixture,
            customer=customer,
            product=product_recurring_metered,
            subscription=subscription,
            status=OrderStatus.draft,
            subtotal_amount=0,
        )

        assert order.is_payment_setup_required


@pytest.mark.parametrize(
    (
        "tax_behavior",
        "subtotal_amount",
        "tax_amount",
        "applied_balance_amount",
        "total_refund_amount",
        "expected_refund_amount",
        "expected_refund_tax_amount",
    ),
    [
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            1250,
            1000,
            250,
            id="exclusive refund subtotal amount with tax",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            2250,
            2000,
            250,
            id="exclusive refund subtotal + balance with tax",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            -500,
            750,
            500,
            250,
            id="exclusive full refund with negative balance",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            0,
            1300,
            1050,
            250,
            id="exclusive refund exceeding original amount",
        ),
        pytest.param(
            TaxBehavior.inclusive,
            1000,
            200,
            0,
            1000,
            800,
            200,
            id="inclusive full amount",
        ),
        pytest.param(
            TaxBehavior.inclusive,
            1000,
            200,
            0,
            500,
            400,
            100,
            id="inclusive half amount",
        ),
    ],
)
@pytest.mark.anyio
async def test_calculate_refunded_tax_from_total(
    tax_behavior: TaxBehavior,
    subtotal_amount: int,
    tax_amount: int,
    applied_balance_amount: int,
    total_refund_amount: int,
    expected_refund_amount: int,
    expected_refund_tax_amount: int,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
        tax_behavior=tax_behavior,
    )
    assert order.refunded_amount == 0
    assert order.refunded_tax_amount == 0
    assert order.net_amount == subtotal_amount - (
        tax_amount if tax_behavior == TaxBehavior.inclusive else 0
    )

    refund_amount, refund_tax_amount = order.calculate_refunded_tax_from_total(
        total_refund_amount
    )

    assert refund_amount == expected_refund_amount
    assert refund_tax_amount == expected_refund_tax_amount


@pytest.mark.parametrize(
    (
        "tax_behavior",
        "subtotal_amount",
        "tax_amount",
        "applied_balance_amount",
        "refund_amount",
        "expected_refund_tax_amount",
    ),
    [
        pytest.param(
            TaxBehavior.exclusive, 1000, 250, 0, 1000, 250, id="exclusive full amount"
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            2000,
            250,
            id="exclusive full amount with applied balance",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            500,
            125,
            id="exclusive sub amount with applied balance",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            250,
            1000,
            1500,
            250,
            id="exclusive sub amount exceeding net with applied balance is capped",
        ),
        pytest.param(
            TaxBehavior.exclusive,
            1000,
            0,
            1000,
            1500,
            0,
            id="exclusive untaxed with applied balance",
        ),
        pytest.param(
            TaxBehavior.inclusive, 1000, 200, 0, 800, 200, id="inclusive full amount"
        ),
        pytest.param(
            TaxBehavior.inclusive, 1000, 200, 0, 400, 100, id="inclusive half amount"
        ),
    ],
)
@pytest.mark.anyio
async def test_calculate_refunded_tax_from_subtotal(
    tax_behavior: TaxBehavior,
    subtotal_amount: int,
    tax_amount: int,
    applied_balance_amount: int,
    refund_amount: int,
    expected_refund_tax_amount: int,
    save_fixture: SaveFixture,
    product: Product,
    customer: Customer,
) -> None:
    order = await create_order(
        save_fixture,
        product=product,
        customer=customer,
        subtotal_amount=subtotal_amount,
        tax_amount=tax_amount,
        applied_balance_amount=applied_balance_amount,
        tax_behavior=tax_behavior,
    )
    assert order.refunded_amount == 0
    assert order.refunded_tax_amount == 0

    refund_tax_amount = order.calculate_refunded_tax_from_subtotal(refund_amount)

    assert refund_tax_amount == expected_refund_tax_amount


class TestFormatPriceLabel:
    def test_seat_plural(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=14)
            == "Acme Pro (14 seats)"
        )

    def test_seat_singular(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=1)
            == "Acme Pro (1 seat)"
        )

    def test_seat_without_count(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceSeatUnit(), seats=None)
            == "Acme Pro"
        )

    def test_fixed(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(product, ProductPriceFixed(), seats=10)
            == "Acme Pro"
        )

    def test_unit_default_plural(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(
                product, ProductPriceUnit(), seats=None, units=3
            )
            == "Acme Pro (3 units)"
        )

    def test_unit_default_singular(self) -> None:
        product = Product(name="Acme Pro")
        assert (
            OrderItem.format_price_label(
                product, ProductPriceUnit(), seats=None, units=1
            )
            == "Acme Pro (1 unit)"
        )

    def test_unit_custom_label(self) -> None:
        product = Product(name="Acme Pro")
        price = ProductPriceUnit(
            unit_label={"en": {"=1": "device", "other": "devices"}}
        )
        assert (
            OrderItem.format_price_label(product, price, seats=None, units=3)
            == "Acme Pro (3 devices)"
        )
        assert (
            OrderItem.format_price_label(product, price, seats=None, units=1)
            == "Acme Pro (1 device)"
        )


@pytest.mark.anyio
class TestUpdateRefunds:
    async def test_tax_only(
        self, save_fixture: SaveFixture, customer: Customer
    ) -> None:
        order = await create_order(
            save_fixture,
            customer=customer,
            subtotal_amount=100_00,
            tax_amount=20_00,
        )

        order.update_refunds(refunded_amount=0, refunded_tax_amount=20_00)

        assert order.status == OrderStatus.paid
        assert order.refunded_amount == 0
        assert order.refunded_tax_amount == 20_00
        assert order.refundable_amount == 100_00
        assert order.refundable_tax_amount == 0
