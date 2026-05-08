from typing import Any

from polar_sdk.models import Product, Subscription

from polar.integrations.polar.schemas import (
    OrganizationPlan,
    OrganizationSubscription,
)

_PRODUCT_BASE: dict[str, Any] = {
    "id": "prod_1",
    "created_at": "2026-01-01T00:00:00Z",
    "modified_at": None,
    "trial_interval": None,
    "trial_interval_count": None,
    "name": "Pro",
    "description": "Pro plan",
    "visibility": "public",
    "recurring_interval": "month",
    "recurring_interval_count": 1,
    "is_recurring": True,
    "is_archived": False,
    "organization_id": "org_1",
    "metadata": {},
    "prices": [],
    "benefits": [],
    "medias": [],
    "attached_custom_fields": [],
}


def _fixed_price(*, amount: int = 2000, currency: str = "usd") -> dict[str, Any]:
    return {
        "id": "price_1",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "source": "catalog",
        "price_currency": currency,
        "tax_behavior": None,
        "is_archived": False,
        "product_id": "prod_1",
        "price_amount": amount,
        "amount_type": "fixed",
    }


def _fee_benefit(*, fee_percent: int = 380, fee_fixed: int = 35) -> dict[str, Any]:
    return {
        "id": "ben_fee",
        "type": "custom",
        "created_at": "2026-01-01T00:00:00Z",
        "modified_at": None,
        "description": "fee",
        "selectable": True,
        "deletable": True,
        "is_deleted": False,
        "organization_id": "org_1",
        "metadata": {
            "type": "transaction_fee",
            "fee_percent": fee_percent,
            "fee_fixed": fee_fixed,
        },
        "properties": {"note": None},
    }


def _make_product(**overrides: Any) -> Product:
    data = {**_PRODUCT_BASE, **overrides}
    return Product.model_validate(data)


class TestOrganizationPlanFromSdk:
    def test_minimal_product(self) -> None:
        plan = OrganizationPlan.from_sdk(_make_product())

        assert plan.product_id == "prod_1"
        assert plan.name == "Pro"
        assert plan.recurring_interval == "month"
        assert plan.price is None
        assert plan.transaction_fee is None
        assert plan.highlight is False
        assert plan.features == []

    def test_extracts_fixed_price(self) -> None:
        plan = OrganizationPlan.from_sdk(
            _make_product(prices=[_fixed_price(amount=2000, currency="usd")])
        )

        assert plan.price is not None
        assert plan.price.amount == 2000
        assert plan.price.currency == "usd"

    def test_extracts_transaction_fee(self) -> None:
        plan = OrganizationPlan.from_sdk(
            _make_product(benefits=[_fee_benefit(fee_percent=380, fee_fixed=35)])
        )

        assert plan.transaction_fee is not None
        assert plan.transaction_fee.percent == 380
        assert plan.transaction_fee.fixed == 35

    def test_string_fee_metadata(self) -> None:
        # Polar benefit metadata can come back as strings.
        plan = OrganizationPlan.from_sdk(
            _make_product(
                benefits=[
                    {
                        **_fee_benefit(),
                        "metadata": {
                            "type": "transaction_fee",
                            "fee_percent": "380",
                            "fee_fixed": "35",
                        },
                    }
                ]
            )
        )

        assert (
            plan.transaction_fee
            == OrganizationPlan.from_sdk(
                _make_product(benefits=[_fee_benefit(fee_percent=380, fee_fixed=35)])
            ).transaction_fee
        )

    def test_highlight_and_features(self) -> None:
        plan = OrganizationPlan.from_sdk(
            _make_product(
                metadata={
                    "highlight": True,
                    "features": "Slack support, Team permissions",
                }
            )
        )

        assert plan.highlight is True
        assert plan.features == ["Slack support", "Team permissions"]


class TestOrganizationSubscriptionFromSdk:
    def _subscription(self, **overrides: Any) -> Subscription:
        data: dict[str, Any] = {
            "created_at": "2026-01-01T00:00:00Z",
            "modified_at": None,
            "id": "sub_1",
            "amount": 2000,
            "currency": "usd",
            "recurring_interval": "month",
            "recurring_interval_count": 1,
            "status": "active",
            "current_period_start": "2026-01-01T00:00:00Z",
            "current_period_end": "2026-02-01T00:00:00Z",
            "trial_start": None,
            "trial_end": None,
            "cancel_at_period_end": False,
            "canceled_at": None,
            "started_at": "2026-01-01T00:00:00Z",
            "ends_at": None,
            "ended_at": None,
            "customer_id": "cus_1",
            "product_id": "prod_1",
            "discount_id": None,
            "checkout_id": None,
            "customer_cancellation_reason": None,
            "customer_cancellation_comment": None,
            "metadata": {},
            "customer": {
                "id": "cus_1",
                "created_at": "2026-01-01T00:00:00Z",
                "modified_at": None,
                "metadata": {},
                "email": "c@e.com",
                "email_verified": True,
                "type": "individual",
                "name": "c",
                "billing_address": None,
                "tax_id": None,
                "organization_id": "org_1",
                "deleted_at": None,
                "avatar_url": "",
                "external_id": "ext_1",
            },
            "product": _PRODUCT_BASE,
            "discount": None,
            "prices": [],
            "meters": [],
            "pending_update": None,
            **overrides,
        }
        return Subscription.model_validate(data)

    def test_basic(self) -> None:
        sub = OrganizationSubscription.from_sdk(self._subscription())

        assert sub.subscription_id == "sub_1"
        assert sub.amount == 2000
        assert sub.currency == "usd"
        assert sub.recurring_interval == "month"
        assert sub.recurring_interval_count == 1
        assert sub.pending_change is None

    def test_pending_product_change(self) -> None:
        sub = OrganizationSubscription.from_sdk(
            self._subscription(
                pending_update={
                    "id": "pu_1",
                    "created_at": "2026-01-15T00:00:00Z",
                    "modified_at": None,
                    "applies_at": "2026-02-01T00:00:00Z",
                    "product_id": "prod_2",
                    "seats": None,
                }
            )
        )

        assert sub.pending_change is not None
        assert sub.pending_change.product_id == "prod_2"

    def test_pending_seat_change_only_is_ignored(self) -> None:
        sub = OrganizationSubscription.from_sdk(
            self._subscription(
                pending_update={
                    "id": "pu_1",
                    "created_at": "2026-01-15T00:00:00Z",
                    "modified_at": None,
                    "applies_at": "2026-02-01T00:00:00Z",
                    "product_id": None,
                    "seats": 5,
                }
            )
        )

        assert sub.pending_change is None
