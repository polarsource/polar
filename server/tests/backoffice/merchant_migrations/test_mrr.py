from typing import Any
from uuid import UUID

from polar.backoffice.merchant_migrations.mrr import Money, MrrBreakdown, breakdown
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    serialize,
)
from polar.merchant_migration.repository import CanonicalRow
from polar.models import MerchantMigration
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)

MIGRATION = MerchantMigration.generate_id()
OTHER_MIGRATION = MerchantMigration.generate_id()


def _product(
    price_id: str,
    amount: int | None,
    *,
    currency: str = "usd",
    interval: str | None = "month",
    interval_count: int = 1,
    migration_id: UUID = MIGRATION,
) -> CanonicalRow:
    product = CanonicalProduct(
        source_id=f"prod_{price_id}:{interval}",
        product_source_id=f"prod_{price_id}",
        name=f"Product {price_id}",
        recurring_interval=interval,
        recurring_interval_count=interval_count,
        prices=[
            CanonicalPrice(
                source_id=price_id,
                currency=currency,
                amount=amount,
                pricing_scheme=CanonicalPricingScheme.fixed,
            )
        ],
    )
    return (
        migration_id,
        MerchantMigrationRecordStatus.imported,
        MerchantMigrationRecordType.product,
        serialize(product),
    )


def _subscription(
    source_id: str,
    price_id: str,
    status: MerchantMigrationRecordStatus,
    *,
    source_status: CanonicalSubscriptionStatus = CanonicalSubscriptionStatus.active,
    quantity: int = 1,
    migration_id: UUID = MIGRATION,
) -> CanonicalRow:
    subscription = CanonicalSubscription(
        source_id=source_id,
        customer_source_id="cus_1",
        price_source_id=price_id,
        status=source_status,
        collection_method=CanonicalCollectionMethod.charge_automatically,
        current_period_start=None,
        current_period_end=None,
        trialing=False,
        paused_collection=False,
        line_item_count=1,
        quantity=quantity,
        payment_method=None,
    )
    return (
        migration_id,
        status,
        MerchantMigrationRecordType.subscription,
        serialize(subscription),
    )


def _split(
    rows: list[CanonicalRow],
) -> tuple[list[CanonicalRow], list[CanonicalRow]]:
    """Products and subscriptions, as the two repository queries return them."""
    return (
        [row for row in rows if row[2] == MerchantMigrationRecordType.product],
        [row for row in rows if row[2] == MerchantMigrationRecordType.subscription],
    )


def _breakdown(rows: list[CanonicalRow]) -> MrrBreakdown:
    products, subscriptions = _split(rows)
    return breakdown(products, subscriptions, [MIGRATION])[MIGRATION]


def _usd(rows: list[CanonicalRow]) -> dict[str, int]:
    result = _breakdown(rows)
    return {
        "on_polar": result.on_polar.amounts.get("usd", 0),
        "to_move": result.to_move.amounts.get("usd", 0),
        "staying": result.staying.amounts.get("usd", 0),
    }


class TestBucketing:
    def test_splits_by_ledger_status(self) -> None:
        rows = [
            _product("price_1", 2900),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
            _subscription("sub_2", "price_1", MerchantMigrationRecordStatus.pending),
            _subscription("sub_3", "price_1", MerchantMigrationRecordStatus.skipped),
            _subscription("sub_4", "price_1", MerchantMigrationRecordStatus.failed),
        ]

        assert _usd(rows) == {"on_polar": 2900, "to_move": 2900, "staying": 5800}

    def test_total_is_every_bucket(self) -> None:
        rows = [
            _product("price_1", 1000),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
            _subscription("sub_2", "price_1", MerchantMigrationRecordStatus.pending),
        ]

        result = _breakdown(rows)

        assert result.total.amounts == {"usd": 2000}
        assert result.migrated_percent == 50

    def test_a_migration_with_nothing_staged_is_empty(self) -> None:
        result = breakdown([], [], [MIGRATION])[MIGRATION]

        assert result.total.is_zero
        assert result.migrated_percent == 0

    def test_rows_from_another_migration_do_not_leak(self) -> None:
        rows = [
            _product("price_1", 2900),
            _subscription(
                "sub_1",
                "price_1",
                MerchantMigrationRecordStatus.imported,
                migration_id=OTHER_MIGRATION,
            ),
        ]

        assert _usd(rows)["on_polar"] == 0


class TestNormalization:
    def test_a_yearly_price_is_a_twelfth(self) -> None:
        rows = [
            _product("price_1", 12000, interval="year"),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        assert _usd(rows)["on_polar"] == 1000

    def test_a_multi_month_interval_is_divided_by_its_count(self) -> None:
        rows = [
            _product("price_1", 9000, interval="month", interval_count=3),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        assert _usd(rows)["on_polar"] == 3000

    def test_a_weekly_price_is_scaled_up_to_a_month(self) -> None:
        rows = [
            _product("price_1", 1000, interval="week"),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        # 30.44 days a month over a 7-day period.
        assert _usd(rows)["on_polar"] == 4349

    def test_quantity_multiplies_the_amount(self) -> None:
        rows = [
            _product("price_1", 2900),
            _subscription(
                "sub_1", "price_1", MerchantMigrationRecordStatus.imported, quantity=5
            ),
        ]

        assert _usd(rows)["on_polar"] == 14500

    def test_a_one_off_price_contributes_nothing(self) -> None:
        rows = [
            _product("price_1", 2900, interval=None),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        assert _usd(rows)["on_polar"] == 0


class TestExclusions:
    def test_a_source_status_that_is_not_earning_is_excluded(self) -> None:
        rows = [
            _product("price_1", 2900),
            _subscription(
                "sub_1",
                "price_1",
                MerchantMigrationRecordStatus.skipped,
                source_status=CanonicalSubscriptionStatus.canceled,
            ),
        ]

        assert _usd(rows)["staying"] == 0

    def test_a_trial_counts_as_expected_revenue(self) -> None:
        rows = [
            _product("price_1", 2900),
            _subscription(
                "sub_1",
                "price_1",
                MerchantMigrationRecordStatus.pending,
                source_status=CanonicalSubscriptionStatus.trialing,
            ),
        ]

        assert _usd(rows)["to_move"] == 2900

    def test_a_price_with_no_representable_amount_is_skipped(self) -> None:
        rows = [
            _product("price_1", None),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        assert _usd(rows)["on_polar"] == 0

    def test_a_subscription_whose_product_was_never_staged_is_skipped(self) -> None:
        rows = [
            _subscription(
                "sub_1", "price_missing", MerchantMigrationRecordStatus.pending
            )
        ]

        assert _usd(rows)["to_move"] == 0

    def test_a_product_staged_by_an_earlier_run_still_prices_it(self) -> None:
        """The price index spans every row read, not just this migration's."""
        rows = [
            _product("price_1", 2900, migration_id=OTHER_MIGRATION),
            _subscription("sub_1", "price_1", MerchantMigrationRecordStatus.imported),
        ]

        assert _usd(rows)["on_polar"] == 2900


class TestMultipleCurrencies:
    def test_currencies_are_kept_apart(self) -> None:
        rows = [
            _product("price_usd", 2900, currency="usd"),
            _product("price_eur", 2500, currency="eur"),
            _subscription("sub_1", "price_usd", MerchantMigrationRecordStatus.imported),
            _subscription("sub_2", "price_eur", MerchantMigrationRecordStatus.imported),
        ]

        result = _breakdown(rows)

        assert result.on_polar.amounts == {"usd": 2900, "eur": 2500}

    def test_by_size_puts_the_biggest_currency_first(self) -> None:
        amount = Money({"eur": 100, "usd": 900})

        assert amount.by_size() == [("usd", 900), ("eur", 100)]


class TestMoney:
    def test_adding_merges_currencies(self) -> None:
        total = Money({"usd": 100}) + Money({"usd": 50, "eur": 20})

        assert total.amounts == {"usd": 150, "eur": 20}

    def test_all_zero_reads_as_zero(self) -> None:
        assert Money({"usd": 0}).is_zero
        assert Money().is_zero
        assert not Money({"usd": 1}).is_zero


class TestCanonicalShape:
    def test_serialized_canonicals_are_what_the_ledger_stores(self) -> None:
        """The calculation reads raw JSONB, so it has to match `serialize`'s output."""
        _, _, _, canonical = _subscription(
            "sub_1", "price_1", MerchantMigrationRecordStatus.pending
        )
        stored: dict[str, Any] = canonical

        assert stored["price_source_id"] == "price_1"
        assert stored["status"] == "active"
        assert stored["quantity"] == 1
