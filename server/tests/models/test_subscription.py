import pytest

from polar.enums import TaxBehavior
from polar.models import Order, Subscription
from polar.models.subscription_product_price import SubscriptionProductPrice


def _prices(*amounts: int) -> list[SubscriptionProductPrice]:
    return [SubscriptionProductPrice(amount=amount) for amount in amounts]


def _charge(
    tax_behavior: TaxBehavior | None, net_amount: int, tax_amount: int | None
) -> Order:
    return Order(
        tax_behavior=tax_behavior, net_amount=net_amount, tax_amount=tax_amount
    )


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
