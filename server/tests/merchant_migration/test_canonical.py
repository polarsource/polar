from datetime import UTC, datetime

from polar.kit.currency import PresentmentCurrency
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalDiscount,
    CanonicalDiscountDuration,
    CanonicalDiscountType,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    deserialize,
    polar_discount_amounts,
    polar_discount_code,
    serialize,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordType


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
        }


class TestDeserialize:
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

    def test_discount_round_trips(self) -> None:
        discount = CanonicalDiscount(
            source_id="coupon_1",
            name="Launch",
            discount_type=CanonicalDiscountType.percentage,
            duration=CanonicalDiscountDuration.forever,
            duration_in_months=None,
            basis_points=1000,
            amounts={},
            code="LAUNCH",
            extra_codes=1,
            ends_at=datetime(2027, 1, 1, tzinfo=UTC),
            max_redemptions=5,
            product_source_ids=["prod_1"],
        )

        result = deserialize(MerchantMigrationRecordType.discount, serialize(discount))

        assert isinstance(result, CanonicalDiscount)
        assert result.code == "LAUNCH"
        assert result.extra_codes == 1
        assert result.product_source_ids == ["prod_1"]
        assert result.ends_at == datetime(2027, 1, 1, tzinfo=UTC)

    def test_subscription_deserializes_discount_ids(self) -> None:
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
            has_discount=True,
            discount_source_ids=["coupon_1"],
            currency="usd",
        )

        result = deserialize(
            MerchantMigrationRecordType.subscription, serialize(subscription)
        )

        assert isinstance(result, CanonicalSubscription)
        assert result.discount_source_ids == ["coupon_1"]

    def test_legacy_subscription_blob_without_discount_ids_still_skips(self) -> None:
        data = serialize(
            CanonicalSubscription(
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
        )
        data.pop("discount_source_ids", None)
        data["has_discount"] = True

        result = deserialize(MerchantMigrationRecordType.subscription, data)

        assert isinstance(result, CanonicalSubscription)
        assert result.has_discount is True
        assert result.discount_source_ids == []


class TestPolarDiscountCode:
    def test_strips_dashes(self) -> None:
        assert polar_discount_code("LAUNCH-10") == "LAUNCH10"

    def test_rejects_too_short(self) -> None:
        assert polar_discount_code("AB") is None


class TestPolarDiscountAmounts:
    def test_keeps_supported_amounts(self) -> None:
        assert polar_discount_amounts({"USD": 100, "xyz": 50}) == {
            PresentmentCurrency.usd: 100
        }

    def test_drops_amounts_above_polar_max(self) -> None:
        assert polar_discount_amounts({"usd": 1_000_000_000_000}) == {}
