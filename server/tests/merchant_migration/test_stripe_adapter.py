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


async def _iterate(items: list[Any]) -> AsyncIterator[Any]:
    for item in items:
        yield item


def _stripe_product(id: str = "prod_1") -> stripe_lib.Product:
    return stripe_lib.Product.construct_from(
        {"id": id, "active": True, "name": "Pro"},
        None,
    )


def _stripe_price(
    id: str, *, interval: str = "month", amount: int = 1000
) -> stripe_lib.Price:
    return stripe_lib.Price.construct_from(
        {
            "id": id,
            "active": True,
            "currency": "usd",
            "unit_amount": amount,
            "billing_scheme": "per_unit",
            "recurring": {
                "interval": interval,
                "interval_count": 1,
                "usage_type": "licensed",
            },
        },
        None,
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


@pytest.mark.asyncio
class TestExtractBatch:
    async def test_products_page_keeps_all_prices_grouped(
        self, mocker: MockerFixture
    ) -> None:
        adapter, client = _adapter(mocker)
        product = _stripe_product()
        client.v1.products.list_async = mocker.AsyncMock(
            return_value=mocker.MagicMock(data=[product], has_more=True)
        )
        prices = mocker.MagicMock()
        prices.auto_paging_iter.return_value = _iterate(
            [_stripe_price("price_1"), _stripe_price("price_2", amount=2000)]
        )
        client.v1.prices.list_async = mocker.AsyncMock(return_value=prices)

        records, cursor = await adapter.extract_batch(cursor=None, limit=25)

        assert len(records) == 1
        record = records[0]
        assert isinstance(record, CanonicalProduct)
        assert [price.source_id for price in record.prices] == ["price_1", "price_2"]
        assert cursor == {"phase": "products", "starting_after": "prod_1"}
        client.v1.products.list_async.assert_awaited_once_with(
            params={"active": True, "limit": 25}
        )
        client.v1.prices.list_async.assert_awaited_once_with(
            params={"active": True, "product": "prod_1", "limit": 100}
        )

    async def test_finished_phase_advances_to_next_phase(
        self, mocker: MockerFixture
    ) -> None:
        adapter, _ = _adapter(mocker)
        page_customers = mocker.patch.object(
            adapter, "_page_customers", return_value=([], None)
        )

        records, cursor = await adapter.extract_batch(
            cursor={"phase": "customers", "starting_after": "cus_1"},
            limit=25,
        )

        assert records == []
        assert cursor == {"phase": "subscriptions"}
        page_customers.assert_awaited_once_with("cus_1", 25)

    async def test_finished_subscriptions_complete_extraction(
        self, mocker: MockerFixture
    ) -> None:
        adapter, _ = _adapter(mocker)
        mocker.patch.object(adapter, "_page_subscriptions", return_value=([], None))

        records, cursor = await adapter.extract_batch(
            cursor={"phase": "subscriptions"},
            limit=25,
        )

        assert records == []
        assert cursor is None

    async def test_unknown_phase_is_rejected(self, mocker: MockerFixture) -> None:
        adapter, _ = _adapter(mocker)

        with pytest.raises(ValueError, match="Unknown extract phase"):
            await adapter.extract_batch(cursor={"phase": "invoices"}, limit=25)


def _stripe_subscription(
    *,
    status: str = "active",
    cancel_at_period_end: bool = False,
    trial_end: int | None = None,
    cancellation_comment: str | None = None,
    items: list[dict[str, Any]] | None = None,
) -> stripe_lib.Subscription:
    return stripe_lib.Subscription.construct_from(
        {
            "id": "sub_1",
            "customer": "cus_1",
            "status": status,
            "collection_method": "charge_automatically",
            "cancel_at_period_end": cancel_at_period_end,
            "pause_collection": None,
            "trial_end": trial_end,
            "default_payment_method": None,
            "discounts": [],
            "cancellation_details": (
                {"comment": cancellation_comment} if cancellation_comment else None
            ),
            "items": {
                "data": items
                if items is not None
                else [
                    {
                        "price": {"id": "price_1"},
                        "quantity": 1,
                        "current_period_start": 1_700_000_000,
                        "current_period_end": 1_702_000_000,
                    }
                ]
            },
        },
        None,
    )


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
