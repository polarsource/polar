from collections.abc import AsyncIterator
from datetime import UTC, datetime
from typing import Any

import pytest
import stripe as stripe_lib
from pytest_mock import MockerFixture

from polar.merchant_migration.adapters.stripe import (
    CANCELLATION_COMMENT_PREFIX,
    StripeAdapter,
)
from polar.merchant_migration.canonical import (
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscriptionStatus,
)


def _adapter(mocker: MockerFixture) -> tuple[StripeAdapter, Any]:
    adapter = StripeAdapter("rk_test")
    client: Any = mocker.MagicMock()
    adapter._client = client
    return adapter, client


def _all_scopes_present(mocker: MockerFixture, client: Any) -> None:
    for resource in (
        "customers",
        "products",
        "prices",
        "subscriptions",
        "payment_methods",
    ):
        getattr(client.v1, resource).list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[])
        )
    # The write probe hits a non-existent subscription: with the permission it
    # fails "no such subscription", which is not a PermissionError.
    client.v1.subscriptions.cancel_async = mocker.AsyncMock(
        side_effect=stripe_lib.InvalidRequestError("no such subscription", "id")
    )


@pytest.mark.asyncio
class TestVerifyScopes:
    async def test_all_scopes_present(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)

        assert await adapter.verify_scopes() == []

    async def test_missing_read_scope_reported(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.prices.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing price scope")
        )

        assert await adapter.verify_scopes() == ["Prices"]

    async def test_missing_write_scope_reported(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing write scope")
        )

        assert await adapter.verify_scopes() == ["Subscriptions (write)"]

    async def test_invalid_key_raises(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.customers.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.AuthenticationError("bad key")
        )

        with pytest.raises(stripe_lib.AuthenticationError):
            await adapter.verify_scopes()

    async def test_transient_error_propagates(self, mocker: MockerFixture) -> None:
        # A non-permission error must NOT be swallowed as "scope granted" — it
        # propagates so the caller fails closed instead of accepting the key.
        adapter, client = _adapter(mocker)
        _all_scopes_present(mocker, client)
        client.v1.prices.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.RateLimitError("rate limited")
        )

        with pytest.raises(stripe_lib.StripeError):
            await adapter.verify_scopes()


@pytest.mark.asyncio
class TestGetAccountId:
    async def test_returns_account_id(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(id="acct_123")
        )

        assert await adapter.get_account_id() == "acct_123"

    async def test_scope_gap_returns_none(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )

        assert await adapter.get_account_id() is None

    async def test_account_is_read_once(self, mocker: MockerFixture) -> None:
        # Creating a migration needs both the id and the country; one read serves
        # both.
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(id="acct_123", country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("not a platform")
        )

        assert (await adapter.get_source_account()).country == "US"
        assert await adapter.get_account_id() == "acct_123"

        client.v1.accounts.retrieve_current_async.assert_awaited_once()

    async def test_failed_read_is_not_cached(self, mocker: MockerFixture) -> None:
        # A rate limit on the first read must not cost the account id for the
        # rest of the adapter's life.
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=[
                stripe_lib.RateLimitError("rate limited"),
                mocker.MagicMock(id="acct_123"),
            ]
        )

        assert await adapter.get_account_id() is None
        assert await adapter.get_account_id() == "acct_123"


@pytest.mark.asyncio
class TestGetSourceAccount:
    async def test_platform_with_connected_accounts_is_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[mocker.MagicMock(id="acct_123")])
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is True

    async def test_empty_account_list_is_not_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[])
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is False
        assert account.country == "US"

    async def test_missing_connect_scope_is_not_flagged(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(country="US")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("no connect access")
        )

        account = await adapter.get_source_account()

        assert account.has_connected_accounts is False
        assert account.country == "US"

    async def test_scope_gap_is_tolerated(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.accounts.retrieve_current_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )
        client.v1.accounts.list_async = mocker.AsyncMock(
            side_effect=stripe_lib.PermissionError("missing scope")
        )

        account = await adapter.get_source_account()

        assert account.country is None
        assert account.has_connected_accounts is False


def _stripe_subscription(
    *,
    status: str = "active",
    cancel_at_period_end: bool = False,
    trial_end: int | None = None,
    billing_cycle_anchor: int | None = 1_700_000_000,
    cancellation_comment: str | None = None,
    currency: str = "usd",
    items: list[dict[str, Any]] | None = None,
    payment_method: dict[str, Any] | None = None,
) -> stripe_lib.Subscription:
    return stripe_lib.Subscription.construct_from(
        {
            "id": "sub_1",
            "customer": "cus_1",
            "currency": currency,
            "status": status,
            "collection_method": "charge_automatically",
            "cancel_at_period_end": cancel_at_period_end,
            "pause_collection": None,
            "trial_end": trial_end,
            "billing_cycle_anchor": billing_cycle_anchor,
            "default_payment_method": payment_method,
            "discounts": [],
            "cancellation_details": (
                {"comment": cancellation_comment} if cancellation_comment else None
            ),
            "items": {
                "data": items
                if items is not None
                else [
                    {
                        "price": {"id": "price_1", "currency": "usd"},
                        "quantity": 1,
                        "current_period_start": 1_700_000_000,
                        "current_period_end": 1_702_000_000,
                    }
                ]
            },
        },
        None,
    )


def _stripe_price(
    *,
    currency: str = "usd",
    unit_amount: int | None = 1000,
    currency_options: dict[str, Any] | None = None,
) -> stripe_lib.Price:
    price: dict[str, Any] = {
        "id": "price_1",
        "object": "price",
        "currency": currency,
        "unit_amount": unit_amount,
        "billing_scheme": "per_unit",
        "recurring": {
            "interval": "month",
            "interval_count": 1,
            "usage_type": "licensed",
        },
        "product": {
            "id": "prod_1",
            "object": "product",
            "active": True,
            "name": "Pro",
        },
    }
    if currency_options is not None:
        price["currency_options"] = currency_options
    return stripe_lib.Price.construct_from(price, None)


def _listed_prices(
    mocker: MockerFixture, client: Any, *prices: stripe_lib.Price
) -> None:
    async def paging() -> AsyncIterator[stripe_lib.Price]:
        for price in prices:
            yield price

    listing = mocker.MagicMock()
    listing.auto_paging_iter = paging
    client.v1.prices.list_async = mocker.AsyncMock(return_value=listing)


async def _extracted_products(adapter: StripeAdapter) -> list[CanonicalProduct]:
    return [product async for product in adapter._extract_products()]


@pytest.mark.asyncio
class TestExtractProducts:
    async def test_single_currency_price_keeps_the_source_id(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(mocker, client, _stripe_price())

        products = await _extracted_products(adapter)

        assert len(products) == 1
        price = products[0].prices[0]
        assert (price.source_id, price.currency, price.amount) == (
            "price_1",
            "usd",
            1000,
        )
        assert price.pricing_scheme == CanonicalPricingScheme.fixed

    async def test_multi_currency_price_yields_one_price_per_currency(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(
            mocker,
            client,
            _stripe_price(
                currency="eur",
                unit_amount=900,
                currency_options={
                    "eur": {"unit_amount": 900},
                    "usd": {"unit_amount": 1000},
                },
            ),
        )

        products = await _extracted_products(adapter)

        assert len(products) == 1
        assert [
            (price.source_id, price.currency, price.amount)
            for price in products[0].prices
        ] == [("price_1", "eur", 900), ("price_1:usd", "usd", 1000)]

    async def test_currency_options_are_expanded(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        _listed_prices(mocker, client)

        await _extracted_products(adapter)

        _, kwargs = client.v1.prices.list_async.call_args
        assert "data.currency_options" in kwargs["params"]["expand"]


@pytest.mark.asyncio
class TestGetSubscription:
    async def test_reads_the_current_state(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(cancel_at_period_end=True)
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.status == CanonicalSubscriptionStatus.active
        assert subscription.cancel_at_period_end is True
        assert subscription.current_period_end is not None

    async def test_reads_the_price_it_is_billed_in(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                currency="usd",
                items=[
                    {
                        "price": {"id": "price_1", "currency": "eur"},
                        "quantity": 1,
                        "current_period_start": 1_700_000_000,
                        "current_period_end": 1_702_000_000,
                    }
                ],
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.price_source_id == "price_1:usd"

    async def test_default_currency_keeps_the_bare_price_id(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(currency="usd")
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.price_source_id == "price_1"

    async def test_carries_the_card_details_the_copy_keeps(
        self, mocker: MockerFixture
    ) -> None:
        """A copy re-mints the `pm_…` id, so these are what identifies the card
        the subscription was actually charging once it lands on our account."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                payment_method={
                    "id": "pm_source",
                    "object": "payment_method",
                    "type": "card",
                    "card": {
                        "last4": "4242",
                        "brand": "visa",
                        "exp_month": 4,
                        "exp_year": 2030,
                    },
                }
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.payment_method == CanonicalPaymentMethod(
            source_id="pm_source",
            type=CanonicalPaymentMethodType.card,
            last4="4242",
            brand="visa",
            exp_month=4,
            exp_year=2030,
        )

    async def test_reads_a_running_trial(self, mocker: MockerFixture) -> None:
        """The cutover keeps the trial running rather than billing at once, so
        it needs the end date back as an aware datetime."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="trialing", trial_end=1_702_000_000
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.status == CanonicalSubscriptionStatus.trialing
        assert subscription.trial_end == datetime(2023, 12, 8, 1, 46, 40, tzinfo=UTC)

    async def test_deleted_subscription_is_gone(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError(
                "No such subscription", "id", code="resource_missing"
            )
        )

        assert await adapter.get_subscription("sub_1") is None

    async def test_other_errors_propagate(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("nope", "id", code="other")
        )

        with pytest.raises(stripe_lib.InvalidRequestError):
            await adapter.get_subscription("sub_1")

    async def test_our_own_cancellation_is_recognised(
        self, mocker: MockerFixture
    ) -> None:
        """Otherwise a retry would read it as the customer having churned."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="canceled",
                cancellation_comment="Migrated to Polar (migration abc)",
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.stopped_for_migration is True

    async def test_a_customer_cancellation_is_not(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(
                status="canceled", cancellation_comment="Too expensive"
            )
        )

        subscription = await adapter.get_subscription("sub_1")

        assert subscription is not None
        assert subscription.stopped_for_migration is False


@pytest.mark.asyncio
class TestStopSourceSubscription:
    async def test_cancels_with_a_traceable_comment(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock()

        await adapter.stop_source_subscription("sub_1", reference="abc")

        _, kwargs = client.v1.subscriptions.cancel_async.call_args
        comment = kwargs["params"]["cancellation_details"]["comment"]
        assert comment.startswith(CANCELLATION_COMMENT_PREFIX)
        assert "abc" in comment

    async def test_already_cancelled_is_done(self, mocker: MockerFixture) -> None:
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("already canceled", "id")
        )
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(status="canceled")
        )

        await adapter.stop_source_subscription("sub_1", reference="abc")

    async def test_a_real_failure_propagates(self, mocker: MockerFixture) -> None:
        """The caller must not activate on Polar while the source keeps billing."""
        adapter, client = _adapter(mocker)
        client.v1.subscriptions.cancel_async = mocker.AsyncMock(
            side_effect=stripe_lib.InvalidRequestError("bad request", "id")
        )
        client.v1.subscriptions.retrieve_async = mocker.AsyncMock(
            return_value=_stripe_subscription(status="active")
        )

        with pytest.raises(stripe_lib.InvalidRequestError):
            await adapter.stop_source_subscription("sub_1", reference="abc")
