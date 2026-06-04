import pytest

from polar.models.discount import DiscountFixed, DiscountPercentage


def _fixed(amount: int, currency: str = "usd") -> DiscountFixed:
    return DiscountFixed(amounts={currency: amount})


def _percentage(basis_points: int) -> DiscountPercentage:
    return DiscountPercentage(basis_points=basis_points)


class TestDiscountFixedAllocateDiscountAmounts:
    def test_waterfall_fixed_first(self) -> None:
        # 1500 over [fixed 1000, seat 1000]: the fixed fee absorbs its full
        # amount first, the remaining 500 flows to the seat amount.
        discount = _fixed(1500)
        assert discount.allocate_discount_amounts([1000, 1000], "usd") == [1000, 500]

    def test_discount_smaller_than_fixed(self) -> None:
        # Discount fully absorbed by the fixed fee, nothing left for the seat.
        discount = _fixed(500)
        assert discount.allocate_discount_amounts([1000, 1000], "usd") == [500, 0]

    def test_discount_larger_than_total(self) -> None:
        # Discount caps at the combined total, never exceeding either amount.
        discount = _fixed(2500)
        assert discount.allocate_discount_amounts([1000, 1000], "usd") == [1000, 1000]

    def test_zero_discount(self) -> None:
        discount = _fixed(0)
        assert discount.allocate_discount_amounts([1000, 1000], "usd") == [0, 0]

    def test_single_amount_no_fixed_component(self) -> None:
        # A single (seat-only) amount receives the whole capped discount — this
        # is the configuration reachable today, and must match get_discount_amount.
        discount = _fixed(1500)
        assert discount.allocate_discount_amounts([1000], "usd") == [1000]
        assert discount.allocate_discount_amounts([2000], "usd") == [1500]

    def test_three_amounts_waterfall(self) -> None:
        discount = _fixed(1500)
        assert discount.allocate_discount_amounts([1000, 1000, 1000], "usd") == [
            1000,
            500,
            0,
        ]

    def test_empty(self) -> None:
        discount = _fixed(1500)
        assert discount.allocate_discount_amounts([], "usd") == []

    @pytest.mark.parametrize(
        ("discount_amount", "amounts"),
        [
            (500, [1000, 1000]),
            (1500, [1000, 1000]),
            (2500, [1000, 1000]),
            (0, [1000, 1000]),
            (1500, [1000, 1000, 1000]),
            (750, [300, 1200]),
        ],
    )
    def test_reconciliation_identity(
        self, discount_amount: int, amounts: list[int]
    ) -> None:
        # The allocated parts always sum to the discount on the combined total.
        discount = _fixed(discount_amount)
        allocated = discount.allocate_discount_amounts(amounts, "usd")
        assert sum(allocated) == discount.get_discount_amount(sum(amounts), "usd")


class TestDiscountPercentageAllocateDiscountAmounts:
    def test_independent_distribution(self) -> None:
        # Each amount is discounted independently; for percentage this already
        # sums correctly when no rounding boundary is crossed.
        discount = _percentage(1000)  # 10%
        assert discount.allocate_discount_amounts([1000, 2000], "usd") == [100, 200]

    def test_matches_per_amount_get_discount_amount(self) -> None:
        discount = _percentage(2500)  # 25%
        amounts = [1000, 333, 4567]
        assert discount.allocate_discount_amounts(amounts, "usd") == [
            discount.get_discount_amount(amount, "usd") for amount in amounts
        ]

    def test_accepted_rounding_drift(self) -> None:
        # 33.33% over [100, 100, 100]: each share rounds to 33 (sum 99), while
        # the discount on the combined 300 rounds to 100. The per-amount drift
        # is accepted because prorations aren't re-pooled at the order level.
        discount = _percentage(3333)
        allocated = discount.allocate_discount_amounts([100, 100, 100], "usd")
        assert allocated == [33, 33, 33]
        assert sum(allocated) == 99
        assert discount.get_discount_amount(300, "usd") == 100

    def test_empty(self) -> None:
        discount = _percentage(1000)
        assert discount.allocate_discount_amounts([], "usd") == []
