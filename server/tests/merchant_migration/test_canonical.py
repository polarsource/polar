from datetime import UTC, datetime

from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
    serialize,
)


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
        )

        result = serialize(subscription)

        assert result["current_period_start"] == "2026-01-01T00:00:00+00:00"
        assert result["current_period_end"] == "2026-02-01T00:00:00+00:00"
        assert result["status"] == "active"
        assert result["payment_method"] == {"source_id": "pm_1", "type": "card"}

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
