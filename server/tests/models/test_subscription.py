import uuid

import pytest

from polar.enums import TaxBehavior
from polar.models import Order, Product, Subscription
from polar.models.discount import DiscountPercentage
from polar.models.discount_product import DiscountProduct
from polar.models.product_price import ProductPriceFixed
from polar.models.subscription_product_price import SubscriptionProductPrice


def _prices(*amounts: int) -> list[SubscriptionProductPrice]:
    return [SubscriptionProductPrice(amount=amount) for amount in amounts]


def _charge(
    tax_behavior: TaxBehavior | None, net_amount: int, tax_amount: int | None
) -> Order:
    return Order(
        tax_behavior=tax_behavior, net_amount=net_amount, tax_amount=tax_amount
    )


def _product() -> Product:
    return Product(id=uuid.uuid4())


def _percentage_discount(*products: Product) -> DiscountPercentage:
    return DiscountPercentage(
        basis_points=5000,
        discount_products=[DiscountProduct(product=product) for product in products],
    )


def _prices_for(product: Product, *amounts: int) -> list[SubscriptionProductPrice]:
    return [
        SubscriptionProductPrice(
            amount=amount, product_price=ProductPriceFixed(product=product)
        )
        for amount in amounts
    ]


class TestUpdateNetAmountFrom:
    def test_exclusive_charge_sets_net_to_amount(self) -> None:
        subscription = Subscription(amount=1000, net_amount=800)
        subscription.update_net_amount_from(_charge(TaxBehavior.exclusive, 1000, 200))
        assert subscription.net_amount == 1000

    @pytest.mark.parametrize(
        ("net_amount", "tax_amount", "amount", "expected_net"),
        [
            (800, 200, 1000, 800),
            (826, 174, 1000, 826),
            # The fraction spans recurring + metered + proration, but is uniform,
            # so the recurring net is still derived correctly.
            (4132, 868, 1000, 826),
        ],
    )
    def test_inclusive_charge_backs_out_tax(
        self, net_amount: int, tax_amount: int, amount: int, expected_net: int
    ) -> None:
        subscription = Subscription(amount=amount, net_amount=amount)
        subscription.update_net_amount_from(
            _charge(TaxBehavior.inclusive, net_amount, tax_amount)
        )
        assert subscription.net_amount == expected_net

    @pytest.mark.parametrize(
        "charge",
        [
            _charge(None, 1000, None),  # failed tax calculation
            _charge(TaxBehavior.inclusive, 0, 0),  # $0 charge
            _charge(TaxBehavior.inclusive, -500, -100),  # credit
        ],
    )
    def test_unusable_charge_leaves_net_unchanged(self, charge: Order) -> None:
        subscription = Subscription(amount=1000, net_amount=826)
        subscription.update_net_amount_from(charge)
        assert subscription.net_amount == 826


class TestUpdateAmountAndCurrency:
    def test_cold_start_falls_back_to_gross(self) -> None:
        subscription = Subscription(currency="usd")
        subscription.update_amount_and_currency(_prices(1000), None)
        assert subscription.amount == 1000
        assert subscription.net_amount == 1000

    def test_preserves_inclusive_ratio_across_amount_change(self) -> None:
        subscription = Subscription(currency="usd", amount=1000, net_amount=800)
        subscription.update_amount_and_currency(_prices(1500, 500), None)
        assert subscription.amount == 2000
        assert subscription.net_amount == 1600

    def test_exclusive_stays_equal(self) -> None:
        subscription = Subscription(currency="usd", amount=1000, net_amount=1000)
        subscription.update_amount_and_currency(_prices(3000), None)
        assert subscription.amount == 3000
        assert subscription.net_amount == 3000

    def test_ineligible_discount_leaves_gross_amount(self) -> None:
        pro = _product()
        discount = _percentage_discount(_product())
        subscription = Subscription(currency="usd")
        subscription.update_amount_and_currency(_prices_for(pro, 2000), discount)
        assert subscription.amount == 2000
        assert subscription.net_amount == 2000

    def test_applicable_discount_reduces_amount(self) -> None:
        go = _product()
        discount = _percentage_discount(go)
        subscription = Subscription(currency="usd")
        subscription.update_amount_and_currency(_prices_for(go, 1000), discount)
        assert subscription.amount == 500
        assert subscription.net_amount == 500

    def test_unrestricted_discount_applies_to_any_product(self) -> None:
        pro = _product()
        discount = _percentage_discount()
        subscription = Subscription(currency="usd")
        subscription.update_amount_and_currency(_prices_for(pro, 2000), discount)
        assert subscription.amount == 1000
        assert subscription.net_amount == 1000
