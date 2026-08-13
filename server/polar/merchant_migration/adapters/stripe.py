"""Reads a merchant's Stripe account with its own restricted-key client
(never Polar's platform key) and normalizes it into CanonicalRecords."""

import asyncio
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime
from typing import Any

import stripe as stripe_lib

from ..canonical import (
    CanonicalAccount,
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPaymentMethod,
    CanonicalPaymentMethodType,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)

# Period data moved onto the subscription item in this version; read it per item.
STRIPE_API_VERSION = "2026-01-28.clover"
PAGE_SIZE = 100
PRODUCT_PRICE_CONCURRENCY = 10

SKIPPED_SUBSCRIPTION_STATUSES = frozenset(
    {"canceled", "incomplete", "incomplete_expired"}
)

# Written to `cancellation_details.comment` when the cutover stops a source
# subscription, and matched when reading one back. A cutover that crashes
# between the Stripe cancellation and its own commit retries against a
# subscription it already cancelled; without this marker the retry would read
# that as the customer having churned and strand the subscription unbilled.
CANCELLATION_COMMENT_PREFIX = "Migrated to Polar"

# Expansions the cutover needs on a single subscription read.
_SUBSCRIPTION_EXPAND = [
    "default_payment_method",
    "customer.invoice_settings.default_payment_method",
    "customer.default_source",
]

type ExtractPage = tuple[list[CanonicalRecord], str | None]

_EXTRACT_PHASES = ("products", "customers", "subscriptions")


class StripeAdapter:
    def __init__(self, access_token: str) -> None:
        self._client = stripe_lib.StripeClient(
            access_token, stripe_version=STRIPE_API_VERSION
        )
        self._account: stripe_lib.Account | None = None

    async def verify_scopes(self) -> list[str]:
        """Probe every permission the migration needs, concurrently, and return the
        labels of the ones the key is missing (empty list = fully scoped).

        Stripe has no endpoint to introspect a restricted key's permissions, so we
        exercise each one: a missing permission raises ``PermissionError``. Any
        other failure — an invalid key (``AuthenticationError``), a rate limit, a
        network blip — propagates, so we fail closed rather than accept a key we
        couldn't fully check. The probes cover exactly what ``extract()`` reads
        plus the ``subscription_write`` needed to stop billing at cutover.
        """
        v1 = self._client.v1
        probes: list[tuple[str, Callable[[], Awaitable[Any]]]] = [
            ("Customers", lambda: v1.customers.list_async(params={"limit": 1})),
            ("Products", lambda: v1.products.list_async(params={"limit": 1})),
            ("Prices", lambda: v1.prices.list_async(params={"limit": 1})),
            ("Subscriptions", lambda: v1.subscriptions.list_async(params={"limit": 1})),
            (
                "Payment methods",
                lambda: v1.payment_methods.list_async(
                    params={"limit": 1, "type": "card"}
                ),
            ),
            ("Subscriptions (write)", self._probe_subscription_write),
        ]
        results = await asyncio.gather(
            *(self._probe_scope(label, probe) for label, probe in probes)
        )
        return [label for label in results if label is not None]

    async def _probe_scope(
        self, label: str, probe: Callable[[], Awaitable[Any]]
    ) -> str | None:
        try:
            await probe()
            return None
        except stripe_lib.PermissionError:
            return label

    async def _probe_subscription_write(self) -> None:
        # Probe write access without side effects: cancelling a non-existent
        # subscription fails with "no such subscription" (InvalidRequestError)
        # when the key can write, and with PermissionError when it can't. Only the
        # former means the scope is granted.
        try:
            await self._client.v1.subscriptions.cancel_async("sub_polar_scope_probe")
        except stripe_lib.InvalidRequestError:
            pass

    async def _current_account(self) -> stripe_lib.Account | None:
        # Best-effort: a restricted key may lack account read scope. Only a
        # successful read is cached — creating a migration needs both the account
        # id and its country, but a rate-limited read must not stick and cost the
        # id we would otherwise have stored.
        if self._account is None:
            try:
                self._account = await self._client.v1.accounts.retrieve_current_async()
            except stripe_lib.StripeError:
                return None
        return self._account

    async def get_account_id(self) -> str | None:
        account = await self._current_account()
        return account.id if account else None

    async def extract_batch(
        self, *, cursor: dict[str, Any] | None, limit: int
    ) -> tuple[list[CanonicalRecord], dict[str, Any] | None]:
        """Page products → customers → subscriptions under an opaque cursor.

        Each phase pages with Stripe ``starting_after``. Product pages load all
        active prices for each product so one canonical product is never split
        across batches.
        """
        phase = "products" if cursor is None else str(cursor["phase"])
        starting_after = None if cursor is None else cursor.get("starting_after")

        page_loaders: dict[str, Callable[[str | None, int], Awaitable[ExtractPage]]] = {
            "products": self._page_products,
            "customers": self._page_customers,
            "subscriptions": self._page_subscriptions,
        }
        try:
            loader = page_loaders[phase]
            phase_index = _EXTRACT_PHASES.index(phase)
        except (KeyError, ValueError):
            raise ValueError(f"Unknown extract phase: {phase}") from None

        records, next_after = await loader(starting_after, limit)
        if next_after is not None:
            return records, {"phase": phase, "starting_after": next_after}
        if phase_index + 1 == len(_EXTRACT_PHASES):
            return records, None
        return records, {"phase": _EXTRACT_PHASES[phase_index + 1]}

    async def _page_products(
        self, starting_after: str | None, limit: int
    ) -> ExtractPage:
        params: dict[str, Any] = {"active": True, "limit": min(limit, PAGE_SIZE)}
        if starting_after is not None:
            params["starting_after"] = starting_after
        page = await self._client.v1.products.list_async(params=params)  # type: ignore[arg-type]
        semaphore = asyncio.Semaphore(PRODUCT_PRICE_CONCURRENCY)

        async def load_product(product: stripe_lib.Product) -> list[CanonicalProduct]:
            async with semaphore:
                return await self._canonical_products(product)

        product_records = await asyncio.gather(
            *(load_product(product) for product in page.data)
        )
        records: list[CanonicalRecord] = [
            record for products in product_records for record in products
        ]
        if not page.has_more or not page.data:
            return records, None
        return records, page.data[-1].id

    async def _page_customers(
        self, starting_after: str | None, limit: int
    ) -> ExtractPage:
        params: dict[str, Any] = {"limit": min(limit, PAGE_SIZE)}
        if starting_after is not None:
            params["starting_after"] = starting_after
        page = await self._client.v1.customers.list_async(params=params)  # type: ignore[arg-type]
        records: list[CanonicalRecord] = [
            self._map_customer(customer) for customer in page.data
        ]
        if not page.has_more or not page.data:
            return records, None
        return records, page.data[-1].id

    async def _page_subscriptions(
        self, starting_after: str | None, limit: int
    ) -> ExtractPage:
        params: dict[str, Any] = {
            "status": "all",
            "limit": min(limit, PAGE_SIZE),
            "expand": [f"data.{path}" for path in _SUBSCRIPTION_EXPAND],
        }
        if starting_after is not None:
            params["starting_after"] = starting_after
        page = await self._client.v1.subscriptions.list_async(params=params)  # type: ignore[arg-type]
        records: list[CanonicalRecord] = []
        last_id: str | None = None
        for subscription in page.data:
            last_id = subscription.id
            if subscription.status in SKIPPED_SUBSCRIPTION_STATUSES:
                continue
            if not subscription["items"]["data"]:
                continue
            records.append(self._map_subscription(subscription))
        if not page.has_more or last_id is None:
            return records, None
        return records, last_id

    async def extract(self) -> AsyncIterator[CanonicalRecord]:
        """Full extract for tests and one-shot callers; prefers ``extract_batch``."""
        cursor: dict[str, Any] | None = None
        while True:
            records, cursor = await self.extract_batch(cursor=cursor, limit=PAGE_SIZE)
            for record in records:
                yield record
            if cursor is None:
                return

    async def _has_connected_accounts(self) -> bool:
        # Best-effort: a restricted key may lack Connect read scope. Stripe
        # answers with an empty list for a non-platform rather than an error, so
        # only an actual connected account counts.
        try:
            accounts = await self._client.v1.accounts.list_async(params={"limit": 1})
        except stripe_lib.StripeError:
            return False
        return bool(accounts.data)

    async def get_source_account(self) -> CanonicalAccount:
        account, has_connected_accounts = await asyncio.gather(
            self._current_account(), self._has_connected_accounts()
        )
        return CanonicalAccount(
            country=account.country if account else None,
            has_connected_accounts=has_connected_accounts,
        )

    async def _canonical_products(
        self, product: stripe_lib.Product
    ) -> list[CanonicalProduct]:
        grouped: dict[str, CanonicalProduct] = {}
        prices = await self._client.v1.prices.list_async(
            params={
                "active": True,
                "product": product.id,
                "limit": PAGE_SIZE,
            }
        )
        async for price in prices.auto_paging_iter():
            recurring = price.recurring
            interval = recurring.interval if recurring else None
            interval_count = recurring.interval_count if recurring else 1
            key = f"{product.id}:{interval}:{interval_count}"
            canonical = grouped.get(key)
            if canonical is None:
                canonical = CanonicalProduct(
                    source_id=key,
                    product_source_id=product.id,
                    name=product.name or "",
                    recurring_interval=interval,
                    recurring_interval_count=interval_count,
                    prices=[],
                )
                grouped[key] = canonical
            canonical.prices.append(self._map_price(price))
        return list(grouped.values())

    async def get_subscription(self, source_id: str) -> CanonicalSubscription | None:
        try:
            subscription = await self._client.v1.subscriptions.retrieve_async(
                source_id, params={"expand": _SUBSCRIPTION_EXPAND}
            )
        except stripe_lib.InvalidRequestError as e:
            # The merchant deleted it on Stripe since the import.
            if e.code == "resource_missing":
                return None
            raise
        if not subscription["items"]["data"]:
            return None
        return self._map_subscription(subscription)

    async def stop_source_subscription(self, source_id: str, *, reference: str) -> None:
        """Cancel the subscription on Stripe, right now.

        No proration and no final invoice: the customer already paid the source
        through the end of the period, and the caller takes the subscription on
        with that same period end. Cancelling one Stripe has already cancelled
        is treated as done, so a retry converges instead of failing.
        """
        comment = f"{CANCELLATION_COMMENT_PREFIX} (migration {reference})"
        try:
            await self._client.v1.subscriptions.cancel_async(
                source_id,
                params={"cancellation_details": {"comment": comment}},
            )
        except stripe_lib.InvalidRequestError:
            if await self._is_stopped(source_id):
                return
            raise

    async def _is_stopped(self, source_id: str) -> bool:
        try:
            subscription = await self._client.v1.subscriptions.retrieve_async(source_id)
        except stripe_lib.InvalidRequestError as e:
            # Gone entirely: it certainly isn't billing anyone.
            return e.code == "resource_missing"
        return subscription.status == "canceled"

    def _map_price(self, price: stripe_lib.Price) -> CanonicalPrice:
        return CanonicalPrice(
            source_id=price.id,
            currency=price.currency,
            amount=price.unit_amount,
            pricing_scheme=self._map_pricing_scheme(price),
        )

    def _map_pricing_scheme(self, price: stripe_lib.Price) -> CanonicalPricingScheme:
        if price.billing_scheme == "tiered":
            return CanonicalPricingScheme.tiered
        recurring = price.recurring
        if recurring is not None and recurring.usage_type == "metered":
            return CanonicalPricingScheme.metered
        return CanonicalPricingScheme.fixed

    def _map_subscription(
        self, subscription: stripe_lib.Subscription
    ) -> CanonicalSubscription:
        items = subscription["items"]["data"]
        first_item = items[0]
        return CanonicalSubscription(
            source_id=subscription.id,
            customer_source_id=self._id_of(subscription.customer),
            price_source_id=self._id_of(first_item["price"]),
            status=self._map_status(subscription.status),
            collection_method=self._map_collection_method(
                subscription.collection_method
            ),
            current_period_start=self._to_datetime(
                first_item.get("current_period_start")
            ),
            current_period_end=self._to_datetime(first_item.get("current_period_end")),
            trialing=subscription.status == "trialing",
            paused_collection=subscription.pause_collection is not None,
            line_item_count=len(items),
            quantity=first_item.get("quantity") or 1,
            payment_method=self._resolve_payment_method(subscription),
            has_discount=bool(subscription.get("discounts"))
            or subscription.get("discount") is not None,
            cancel_at_period_end=bool(subscription.cancel_at_period_end),
            trial_end=self._to_datetime(subscription.trial_end),
            stopped_for_migration=self._stopped_for_migration(subscription),
        )

    def _stopped_for_migration(self, subscription: stripe_lib.Subscription) -> bool:
        """Prefix, not the full reference: missing our own cancellation strands a
        customer billed by nobody, while matching someone else's only takes over a
        subscription whose source billing is already stopped."""
        if subscription.status != "canceled":
            return False
        details = subscription.cancellation_details
        comment = details.comment if details is not None else None
        return bool(comment and comment.startswith(CANCELLATION_COMMENT_PREFIX))

    def _map_customer(self, customer: stripe_lib.Customer) -> CanonicalCustomer:
        address = customer.address
        return CanonicalCustomer(
            source_id=customer.id,
            email=customer.email or "",
            name=customer.name,
            country=address.country if address is not None else None,
        )

    def _resolve_payment_method(
        self, subscription: stripe_lib.Subscription
    ) -> CanonicalPaymentMethod | None:
        # Fall back to the customer's default like Stripe does when the sub has
        # no explicit method, so a re-entry-only method isn't silently missed.
        payment_method = self._map_payment_method(subscription.default_payment_method)
        if payment_method is not None:
            return payment_method
        customer = subscription.customer
        if not isinstance(customer, stripe_lib.Customer):
            return None
        invoice_settings = customer.invoice_settings
        if invoice_settings is not None:
            payment_method = self._map_payment_method(
                invoice_settings.default_payment_method
            )
            if payment_method is not None:
                return payment_method
        default_source = customer.default_source
        if default_source is not None and not isinstance(default_source, str):
            # Legacy `source`/`card` object (not a PaymentMethod): doesn't PAN-copy.
            return CanonicalPaymentMethod(
                source_id=default_source["id"], type=CanonicalPaymentMethodType.other
            )
        return None

    def _map_status(self, status: str) -> CanonicalSubscriptionStatus:
        try:
            return CanonicalSubscriptionStatus(status)
        except ValueError:
            return CanonicalSubscriptionStatus.other

    def _map_collection_method(self, method: str | None) -> CanonicalCollectionMethod:
        if method == "send_invoice":
            return CanonicalCollectionMethod.send_invoice
        return CanonicalCollectionMethod.charge_automatically

    def _map_payment_method(self, payment_method: Any) -> CanonicalPaymentMethod | None:
        if not isinstance(payment_method, stripe_lib.PaymentMethod):
            return None
        try:
            type = CanonicalPaymentMethodType(payment_method.type)
        except ValueError:
            type = CanonicalPaymentMethodType.other
        return CanonicalPaymentMethod(source_id=payment_method.id, type=type)

    def _id_of(self, value: Any) -> str:
        if isinstance(value, str):
            return value
        return value["id"]

    def _to_datetime(self, timestamp: int | None) -> datetime | None:
        if timestamp is None:
            return None
        return datetime.fromtimestamp(timestamp, tz=UTC)
