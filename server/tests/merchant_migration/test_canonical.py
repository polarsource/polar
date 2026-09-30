from datetime import UTC, datetime
from typing import Any

import pytest

from polar.enums import TaxBehavior
from polar.kit.currency import PresentmentCurrency
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalDiscount,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    SubscriptionDiscountBlock,
    apply_customer_discount,
    customer_discount_action,
    deserialize,
    discount_started_at_for,
    polar_discount_amounts,
    polar_discount_code,
    serialize,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordType
from tests.merchant_migration._helpers import canonical_discount, canonical_subscription


class TestSerialize:
    def test_product_flattens_nested_prices_and_enums(self) -> None:
        product = CanonicalProduct(
            source_id="prod_1:month:1",
            product_source_id="prod_1",
            name="Pro",
            recurring_interval="month",
            recurring_interval_count=1,
            prices=[
                CanonicalPrice(
                    source_id="price_1",
                    currency="usd",
                    amount=1000,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                )
            ],
        )

        result = serialize(product)

        assert result == {
            "source_id": "prod_1:month:1",
            "product_source_id": "prod_1",
            "name": "Pro",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "prices": [
                {
                    "source_id": "price_1",
                    "currency": "usd",
                    "amount": 1000,
                    "pricing_scheme": "fixed",
                    "is_default": False,
                    "created_at": None,
                    "active": True,
                }
            ],
            "archived": False,
        }
        # the pricing_scheme is a plain string, not a StrEnum instance
        assert type(result["prices"][0]["pricing_scheme"]) is str
        # `type` is a class attribute, not a field, so it isn't serialized
        assert "type" not in result

    def test_subscription_datetimes_become_iso_strings(self) -> None:
        subscription = CanonicalSubscription(
            source_id="sub_1",
            customer_source_id="cus_1",
            price_source_id="price_1",
            status=CanonicalSubscriptionStatus.active,
            collection_method=CanonicalCollectionMethod.charge_automatically,
            current_period_start=datetime(2026, 1, 1, tzinfo=UTC),
            current_period_end=datetime(2026, 2, 1, tzinfo=UTC),
            trialing=False,
            paused_collection=False,
            line_item_count=1,
            quantity=1,
            payment_method=CanonicalPaymentMethod(
                source_id="pm_1", type=CanonicalPaymentMethodType.card
            ),
            currency="usd",
        )

        result = serialize(subscription)

        assert result["current_period_start"] == "2026-01-01T00:00:00+00:00"
        assert result["current_period_end"] == "2026-02-01T00:00:00+00:00"
        assert result["status"] == "active"
        assert result["currency"] == "usd"
        assert result["payment_method"] == {
            "source_id": "pm_1",
            "type": "card",
            "last4": None,
            "brand": None,
            "exp_month": None,
            "exp_year": None,
            "billing_country": None,
            "card_country": None,
        }

    def test_optional_fields_stay_none(self) -> None:
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name=None, country=None
        )

        result = serialize(customer)

        assert result == {
            "source_id": "cus_1",
            "email": "a@example.com",
            "name": None,
            "country": None,
            "country_hint": None,
            "billing_address": None,
            "tax_id": None,
            "tax_id_dropped": False,
            "tax_exempt": False,
        }


class TestDeserialize:
    def test_price_sale_fields_round_trip_and_default_for_legacy_payload(
        self,
    ) -> None:
        price = CanonicalPrice(
            source_id="price_1",
            currency="usd",
            amount=1000,
            pricing_scheme=CanonicalPricingScheme.fixed,
            is_default=True,
            created_at=datetime(2026, 1, 1, tzinfo=UTC),
            active=False,
        )
        product = CanonicalProduct(
            source_id="prod_1:month:1",
            product_source_id="prod_1",
            name="Pro",
            recurring_interval="month",
            recurring_interval_count=1,
            prices=[price],
        )
        legacy = serialize(product)
        del legacy["prices"][0]["is_default"]
        del legacy["prices"][0]["created_at"]
        del legacy["prices"][0]["active"]

        assert (
            deserialize(MerchantMigrationRecordType.product, serialize(product))
            == product
        )
        result = deserialize(MerchantMigrationRecordType.product, legacy)
        assert isinstance(result, CanonicalProduct)
        assert result.prices[0].is_default is False
        assert result.prices[0].created_at is None
        assert result.prices[0].active is True

    def test_customer_tax_id_dropped_round_trips(self) -> None:
        customer = CanonicalCustomer(
            source_id="cus_1",
            email="a@example.com",
            name=None,
            country="FR",
            tax_id_dropped=True,
        )

        result = deserialize(MerchantMigrationRecordType.customer, serialize(customer))

        assert result == customer

    def test_customer_tax_exempt_round_trips(self) -> None:
        customer = CanonicalCustomer(
            source_id="cus_1",
            email="a@example.com",
            name=None,
            country="US",
            tax_exempt=True,
        )

        result = deserialize(MerchantMigrationRecordType.customer, serialize(customer))

        assert result == customer

    def test_customer_tax_flags_default_false_for_legacy_payload(
        self,
    ) -> None:
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name=None, country="FR"
        )
        legacy = serialize(customer)
        del legacy["tax_id_dropped"]
        del legacy["tax_exempt"]

        result = deserialize(MerchantMigrationRecordType.customer, legacy)

        assert result == customer

    def test_subscription_currency(self) -> None:
        subscription = CanonicalSubscription(
            source_id="sub_1",
            customer_source_id="cus_1",
            price_source_id="price_1",
            status=CanonicalSubscriptionStatus.active,
            collection_method=CanonicalCollectionMethod.charge_automatically,
            current_period_start=None,
            current_period_end=None,
            trialing=False,
            paused_collection=False,
            line_item_count=1,
            quantity=1,
            payment_method=None,
            currency="usd",
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.currency == "usd"
        assert result.import_tax_behavior() == TaxBehavior.inclusive

    def test_managed_payments_round_trips(self) -> None:
        subscription = canonical_subscription(managed_payments=True)

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert result == subscription

    def test_managed_payments_defaults_false_for_legacy_payload(self) -> None:
        subscription = canonical_subscription()
        legacy = serialize(subscription)
        del legacy["managed_payments"]

        result = deserialize(MerchantMigrationRecordType.subscription, legacy)

        assert result == subscription

    def test_tax_rate_behavior_round_trips(self) -> None:
        subscription = canonical_subscription(
            has_tax_rates=True, tax_rate_behavior=TaxBehavior.exclusive
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.tax_rate_behavior == TaxBehavior.exclusive

    def test_customer_balance_round_trips(self) -> None:
        subscription = canonical_subscription(customer_balance=-500)

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.customer_balance == -500

    def test_discount_round_trips(self) -> None:
        discount = canonical_discount(
            extra_codes=1,
            ends_at=datetime(2027, 1, 1, tzinfo=UTC),
            max_redemptions=5,
            product_source_ids=["prod_1"],
        )

        result = deserialize(MerchantMigrationRecordType.discount, serialize(discount))

        assert isinstance(result, CanonicalDiscount)
        assert result.code == "LAUNCH"
        assert result.extra_codes == 1
        assert result.max_redemptions == 5
        assert result.product_source_ids == ["prod_1"]
        assert result.ends_at == datetime(2027, 1, 1, tzinfo=UTC)

        exhausted = deserialize(
            MerchantMigrationRecordType.discount,
            serialize(canonical_discount(max_redemptions=0)),
        )
        uncapped = deserialize(
            MerchantMigrationRecordType.discount,
            serialize(canonical_discount(max_redemptions=None)),
        )

        assert isinstance(exhausted, CanonicalDiscount)
        assert isinstance(uncapped, CanonicalDiscount)
        assert exhausted.max_redemptions == 0
        assert uncapped.max_redemptions is None

    def test_legacy_subscription_blob_without_discount_ids_still_skips(self) -> None:
        data = serialize(canonical_subscription(has_discount=True))
        data.pop("discount_source_ids", None)

        result = deserialize(MerchantMigrationRecordType.subscription, data)

        assert isinstance(result, CanonicalSubscription)
        assert result.has_discount is True
        assert result.discount_source_ids == []

    def test_discount_start_round_trips_and_falls_back(self) -> None:
        first = datetime(2023, 11, 14, 22, 13, 20, tzinfo=UTC)
        kept = datetime(2024, 3, 9, 16, 0, tzinfo=UTC)
        subscription = canonical_subscription(
            has_discount=True,
            discount_source_ids=["coupon_old", "coupon_kept"],
            discount_started_at=first,
            discount_starts={"coupon_kept": kept},
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert discount_started_at_for(result, "coupon_kept") == kept
        assert discount_started_at_for(result, "coupon_old") == first
        legacy = canonical_subscription(
            has_discount=True,
            discount_source_ids=["coupon_1"],
            discount_started_at=first,
        )
        assert discount_started_at_for(legacy, "coupon_1") == first
        assert discount_started_at_for(legacy, "coupon_other") is None

    def test_discount_block_round_trips(self) -> None:
        started = datetime(2024, 3, 9, 16, 0, tzinfo=UTC)
        subscription = canonical_subscription(
            has_discount=True,
            customer_discount_source_id="coupon_cust",
            customer_discount_started_at=started,
            discount_block="subscription_item_discount",
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.discount_block == "subscription_item_discount"
        assert result.customer_discount_source_id == "coupon_cust"
        assert result.customer_discount_started_at == started


class TestCustomerDiscount:
    def test_action_matches_only_a_coupon_limited_to_this_product(self) -> None:
        assert customer_discount_action("prod_1", None) == "block"
        assert customer_discount_action("prod_1", []) == "block"
        assert customer_discount_action(None, ["prod_1"]) == "block"
        assert customer_discount_action("prod_1", ["prod_other"]) == "ignore"
        assert customer_discount_action("prod_1", ["prod_1", "prod_other"]) == "block"
        assert customer_discount_action("prod_1", ["prod_1"]) == "apply"

    def test_scoped_coupon_folds_onto_the_subscription(self) -> None:
        started = datetime(2024, 3, 9, 16, 0, tzinfo=UTC)
        subscription = canonical_subscription(
            has_discount=True,
            customer_discount_source_id="coupon_cust",
            customer_discount_started_at=started,
        )

        result = apply_customer_discount(subscription, "prod_1", ["prod_1"])

        assert result.discount_source_ids == ["coupon_cust"]
        assert result.discount_started_at == started
        assert result.discount_starts["coupon_cust"] == started
        assert result.customer_discount_source_id is None
        assert result.discount_block is None

    def test_unrestricted_coupon_blocks(self) -> None:
        subscription = canonical_subscription(
            has_discount=True,
            customer_discount_source_id="coupon_cust",
        )

        result = apply_customer_discount(subscription, "prod_1", [])

        assert result.discount_block == SubscriptionDiscountBlock.customer
        assert result.discount_source_ids == []

    def test_coupon_for_another_product_is_ignored(self) -> None:
        subscription = canonical_subscription(
            has_discount=True,
            customer_discount_source_id="coupon_cust",
        )

        result = apply_customer_discount(subscription, "prod_1", ["prod_other"])

        assert result.has_discount is False
        assert result.discount_block is None
        assert result.customer_discount_source_id is None

    def test_subscription_coupon_is_left_alone(self) -> None:
        subscription = canonical_subscription(
            has_discount=True,
            discount_source_ids=["coupon_sub"],
            customer_discount_source_id="coupon_cust",
        )

        result = apply_customer_discount(subscription, "prod_1", None)

        assert result.discount_source_ids == ["coupon_sub"]
        assert result.discount_block is None
        assert result.customer_discount_source_id == "coupon_cust"


class TestPolarDiscountHelpers:
    def test_code_strips_dashes_and_rejects_short(self) -> None:
        assert polar_discount_code("LAUNCH-10") == "LAUNCH10"
        assert polar_discount_code("AB") is None

    def test_amounts_drop_values_above_polar_max(self) -> None:
        assert polar_discount_amounts({"usd": 1_000_000_000_000}) == {}
        assert polar_discount_amounts({"USD": 100, "xyz": 50}) == {
            PresentmentCurrency.usd: 100
        }


class TestImportTaxBehavior:
    @pytest.mark.parametrize(
        ("kwargs", "expected"),
        [
            ({}, TaxBehavior.inclusive),
            ({"tax_behavior": TaxBehavior.exclusive}, TaxBehavior.exclusive),
            (
                {"automatic_tax": True, "price_tax_behavior": TaxBehavior.exclusive},
                TaxBehavior.exclusive,
            ),
            ({"price_tax_behavior": TaxBehavior.exclusive}, TaxBehavior.inclusive),
            (
                {"has_tax_rates": True, "price_tax_behavior": TaxBehavior.exclusive},
                TaxBehavior.exclusive,
            ),
            (
                {
                    "has_tax_rates": True,
                    "tax_rate_behavior": TaxBehavior.inclusive,
                    "price_tax_behavior": TaxBehavior.exclusive,
                },
                TaxBehavior.inclusive,
            ),
            (
                {"has_tax_rates": True, "tax_rate_behavior": TaxBehavior.exclusive},
                TaxBehavior.exclusive,
            ),
            (
                {
                    "tax_behavior": TaxBehavior.inclusive,
                    "automatic_tax": True,
                    "price_tax_behavior": TaxBehavior.exclusive,
                },
                TaxBehavior.inclusive,
            ),
        ],
    )
    def test_computes_from_source_unless_merchant_pinned(
        self, kwargs: dict[str, Any], expected: TaxBehavior
    ) -> None:
        assert canonical_subscription(**kwargs).import_tax_behavior() == expected
