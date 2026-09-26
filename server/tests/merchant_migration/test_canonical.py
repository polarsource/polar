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
        }


class TestDeserialize:
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

    def test_customer_tax_id_dropped_defaults_false_for_legacy_payload(
        self,
    ) -> None:
        customer = CanonicalCustomer(
            source_id="cus_1", email="a@example.com", name=None, country="FR"
        )
        legacy = serialize(customer)
        del legacy["tax_id_dropped"]

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

    def test_tax_rate_behavior_round_trips(self) -> None:
        subscription = canonical_subscription(
            has_tax_rates=True, tax_rate_behavior=TaxBehavior.exclusive
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.tax_rate_behavior == TaxBehavior.exclusive

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
