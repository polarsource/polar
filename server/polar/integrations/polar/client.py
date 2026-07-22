from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from typing import Any, NoReturn, Unpack, cast
from uuid import UUID

import logfire

from polar.base import (
    PolarClientError,
    PolarNetworkError,
    PolarRateLimitError,
    PolarServerError,
)
from polar.config import settings
from polar.exceptions import PolarError as InternalPolarError
from polar.v2026_04 import PolarAsync as PolarSDK
from polar.v2026_04.inputs import (
    CostMetadataInput,
    CustomerBenefitGrantUpdate,
    CustomerPortalCustomerUpdate,
    EventCreateCustomer,
    EventCreateExternalCustomer,
    EventMetadataInput,
    LLMMetadata,
)
from polar.v2026_04.literals import (
    DiscountDuration,
    SubscriptionProrationBehavior,
)
from polar.v2026_04.literals import (
    Role as MemberCreateRole,
)
from polar.v2026_04.outputs import (
    BenefitGrant,
    Checkout,
    Customer,
    CustomerBenefitGrant,
    CustomerPaymentMethod,
    CustomerPortalCustomer,
    Discount,
    Member,
    Order,
    Product,
    Subscription,
)

from .exceptions import (
    PolarSelfBenefitGrantNotFound,
    PolarSelfNotPaidOrder,
    PolarSelfPaymentMethodInUse,
    PolarSelfPaymentMethodNotFound,
)


class PolarSelfClientError(InternalPolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class PolarSelfClientOperationalError(PolarSelfClientError):
    """Raised for transient/retryable SDK errors (429, 5xx, network)."""


class PolarSelfClientValidationError(InternalPolarError):
    def __init__(self, body: str) -> None:
        super().__init__(body, status_code=422)


def _raise_error(
    span: Any, error: PolarClientError | PolarServerError, operation: str
) -> NoReturn:
    span.set_attribute("http.status_code", error.status_code)
    span.set_attribute("error.body", str(getattr(error, "error", error)))
    message = f"{operation} failed with status {error.status_code}"
    if isinstance(error, (PolarRateLimitError, PolarServerError)):
        raise PolarSelfClientOperationalError(message) from error
    raise PolarSelfClientError(message) from error


def _raise_network_error(span: Any, exc: PolarNetworkError, operation: str) -> NoReturn:
    span.set_attribute("error.type", type(exc).__name__)
    raise PolarSelfClientOperationalError(
        f"{operation} failed with network error: {type(exc).__name__}: {exc}"
    ) from exc


class PolarSelfClient:
    def __init__(self, *, access_token: str, api_url: str) -> None:
        self._sdk = PolarSDK(
            access_token or "unconfigured",
            base_url=api_url,
        )
        self._api_url = api_url

    async def create_customer(
        self,
        *,
        external_id: str,
        name: str,
        slug: str,
        owner_external_id: str,
        owner_email: str,
        owner_name: str,
    ) -> Customer:
        with logfire.span("polar.create_customer", external_id=external_id) as span:
            try:
                return await self._sdk.customers.create(
                    type="team",
                    name=name,
                    external_id=external_id,
                    metadata={"slug": slug},
                    owner={
                        "email": owner_email,
                        "name": owner_name,
                        "external_id": owner_external_id,
                    },
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code != 409:
                    _raise_error(span, e, "create_customer")
                span.set_attribute("conflict", True)
            except PolarNetworkError as e:
                _raise_network_error(span, e, "create_customer")

            try:
                return await self._sdk.customers.get_external(external_id)
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "create_customer.fetch_existing")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "create_customer.fetch_existing")

    async def cancel_subscription(self, *, subscription_id: str) -> Subscription:
        with logfire.span(
            "polar.cancel_subscription",
            subscription_id=subscription_id,
        ) as span:
            try:
                return await self._sdk.subscriptions.update(
                    subscription_id,
                    cancel_at_period_end=True,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "cancel_subscription")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "cancel_subscription")

    async def uncancel_subscription(self, *, subscription_id: str) -> Subscription:
        with logfire.span(
            "polar.uncancel_subscription",
            subscription_id=subscription_id,
        ) as span:
            try:
                return await self._sdk.subscriptions.update(
                    subscription_id,
                    cancel_at_period_end=False,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "uncancel_subscription")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "uncancel_subscription")

    async def get_customer_by_external_id(self, external_id: str) -> Customer:
        return await self._sdk.customers.get_external(external_id)

    async def get_customer_by_external_id_or_none(
        self, external_id: str
    ) -> Customer | None:
        try:
            return await self.get_customer_by_external_id(external_id)
        except (PolarClientError, PolarServerError) as e:
            if e.status_code == 404:
                return None
            raise

    async def list_customer_orders(
        self,
        *,
        customer_id: str,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[list[Order], int]:
        with logfire.span(
            "polar.list_customer_orders",
            customer_id=customer_id,
            page=page,
            limit=limit,
        ) as span:
            try:
                response = await self._sdk.orders.list(
                    customer_id=customer_id,
                    page=page,
                    limit=limit,
                    sorting=["-created_at"],
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "list_customer_orders")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "list_customer_orders")

            items = list(response.items)
            total = response.pagination.total_count
            span.set_attribute("order_count", len(items))
            span.set_attribute("total_count", total)
            return items, total

    async def get_order(self, *, order_id: str) -> Order | None:
        with logfire.span("polar.get_order", order_id=order_id) as span:
            try:
                return await self._sdk.orders.get(order_id)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return None
                _raise_error(span, e, "get_order")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "get_order")

    async def get_order_invoice(self, *, order_id: str) -> str | None:
        with logfire.span("polar.get_order_invoice", order_id=order_id) as span:
            try:
                invoice = await self._sdk.orders.invoice(order_id)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return None
                _raise_error(span, e, "get_order_invoice")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "get_order_invoice")
            return invoice.url

    async def trigger_order_invoice_generation(self, *, order_id: str) -> None:
        """Trigger PDF generation for an order.

        Raises ``PolarSelfNotPaidOrder`` if the API returns 422 — the order's
        payment hasn't settled yet, and the caller should retry later.
        """
        with logfire.span(
            "polar.trigger_order_invoice_generation", order_id=order_id
        ) as span:
            try:
                await self._sdk.orders.generate_invoice(order_id)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 422:
                    span.set_attribute("not_paid", True)
                    span.set_attribute("error.body", str(getattr(e, "error", e)))
                    raise PolarSelfNotPaidOrder(order_id) from e
                _raise_error(span, e, "trigger_order_invoice_generation")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "trigger_order_invoice_generation")

    async def list_recurring_products(self, *, organization_id: str) -> list[Product]:
        with logfire.span(
            "polar.list_recurring_products", organization_id=organization_id
        ) as span:
            products: list[Product] = []
            try:
                async for product in self._sdk.products.iter_list(
                    organization_id=organization_id,
                    is_recurring=True,
                    is_archived=False,
                    visibility=["public"],
                    page=1,
                    limit=100,
                ):
                    products.append(product)
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "list_recurring_products")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "list_recurring_products")

            span.set_attribute("product_count", len(products))
            return products

    async def get_active_subscription(
        self, *, external_customer_id: str
    ) -> Subscription | None:
        with logfire.span(
            "polar.get_active_subscription",
            external_customer_id=external_customer_id,
        ) as span:
            try:
                response = await self._sdk.subscriptions.list(
                    external_customer_id=external_customer_id,
                    status=["trialing", "active", "past_due"],
                    page=1,
                    limit=1,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "get_active_subscription")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "get_active_subscription")

            items = response.items
            span.set_attribute("found", bool(items))
            return items[0] if items else None

    async def create_checkout(
        self,
        *,
        product_id: str,
        external_customer_id: str,
        subscription_id: str | None = None,
        customer_ip_address: str | None = None,
        success_url: str | None = None,
        return_url: str | None = None,
        embed_origin: str | None = None,
        discount_id: str | None = None,
    ) -> Checkout:
        with logfire.span(
            "polar.create_checkout",
            product_id=product_id,
            external_customer_id=external_customer_id,
            subscription_id=subscription_id,
            discount_id=discount_id,
        ) as span:
            try:
                return await self._sdk.checkouts.create(
                    products=[product_id],
                    external_customer_id=external_customer_id,
                    subscription_id=subscription_id,
                    customer_ip_address=customer_ip_address,
                    success_url=success_url,
                    return_url=return_url,
                    embed_origin=embed_origin,
                    discount_id=discount_id,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "create_checkout")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "create_checkout")

    async def update_subscription_product(
        self,
        *,
        subscription_id: str,
        product_id: str,
        proration_behavior: SubscriptionProrationBehavior | None = None,
    ) -> Subscription:
        with logfire.span(
            "polar.update_subscription_product",
            subscription_id=subscription_id,
            product_id=product_id,
        ) as span:
            try:
                return await self._sdk.subscriptions.update(
                    subscription_id,
                    product_id=product_id,
                    proration_behavior=proration_behavior,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "update_subscription_product")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "update_subscription_product")

    async def update_subscription_discount(
        self, *, subscription_id: str, discount_id: str | None
    ) -> Subscription:
        """Apply or clear the discount on a subscription.

        ``discount_id=None`` removes any current discount; passing a
        discount id attaches it. Either way the change takes effect on the
        next billing cycle per the API.
        """
        with logfire.span(
            "polar.update_subscription_discount",
            subscription_id=subscription_id,
            discount_id=discount_id,
        ) as span:
            try:
                return await self._sdk.subscriptions.update(
                    subscription_id,
                    discount_id=discount_id,
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "update_subscription_discount")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "update_subscription_discount")

    async def get_member_by_external_id(
        self, *, external_customer_id: str, external_id: str
    ) -> Member | None:
        return await self._sdk.customers.members.get_external(
            external_customer_id,
            external_id,
        )

    async def list_billing_contacts(self, *, customer_id: str) -> list[Member]:
        contacts: list[Member] = []
        with logfire.span(
            "polar.list_billing_contacts", customer_id=customer_id
        ) as span:
            for role in ("owner", "billing_manager"):
                try:
                    async for contact in self._sdk.members.iter_list_members(
                        customer_id=customer_id,
                        role=role,
                        limit=100,
                    ):
                        contacts.append(contact)
                except (PolarClientError, PolarServerError) as e:
                    _raise_error(span, e, "list_billing_contacts")
                except PolarNetworkError as e:
                    _raise_network_error(span, e, "list_billing_contacts")
            span.set_attribute("count", len(contacts))
            return contacts

    async def add_member(
        self,
        *,
        customer_id: str,
        email: str,
        name: str,
        external_id: str,
        role: str = "member",
    ) -> None:
        with logfire.span(
            "polar.add_member",
            customer_id=customer_id,
            external_id=external_id,
            role=role,
        ) as span:
            try:
                await self._sdk.customers.members.create(
                    customer_id,
                    email=email,
                    name=name,
                    external_id=external_id,
                    role=cast(MemberCreateRole, role),
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "add_member")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "add_member")

    async def update_member(
        self, *, external_customer_id: str, external_id: str, name: str
    ) -> None:
        with logfire.span(
            "polar.update_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
        ) as span:
            try:
                await self._sdk.customers.members.update_external(
                    external_customer_id,
                    external_id,
                    name=name,
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "update_member")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "update_member")

    async def update_customer_metadata(
        self,
        *,
        external_id: str,
        metadata: dict[str, str | int | float | bool],
    ) -> None:
        # The Polar API replaces metadata wholesale on update; callers must
        # merge any existing keys they want to preserve before passing them in.
        with logfire.span(
            "polar.update_customer_metadata", external_id=external_id
        ) as span:
            try:
                await self._sdk.customers.update_external(
                    external_id,
                    metadata=metadata,
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "update_customer_metadata")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "update_customer_metadata")

    async def create_percentage_discount(
        self,
        *,
        name: str,
        basis_points: int,
        duration: DiscountDuration,
        duration_in_months: int | None,
        max_redemptions: int | None,
        products: list[str] | None,
        organization_id: str | None = None,
        metadata: dict[str, str | int | float | bool] | None = None,
    ) -> Discount:
        with logfire.span(
            "polar.create_percentage_discount",
            name=name,
            basis_points=basis_points,
            organization_id=organization_id,
        ) as span:
            try:
                return await self._sdk.discounts.create(
                    type="percentage",
                    name=name,
                    basis_points=basis_points,
                    duration=duration,
                    duration_in_months=duration_in_months,
                    max_redemptions=max_redemptions,
                    products=products,
                    organization_id=organization_id,
                    metadata=metadata or {},
                )
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "create_percentage_discount")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "create_percentage_discount")

    async def get_discount(self, *, discount_id: str) -> Discount | None:
        with logfire.span("polar.get_discount", discount_id=discount_id) as span:
            try:
                return await self._sdk.discounts.get(discount_id)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return None
                _raise_error(span, e, "get_discount")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "get_discount")

    async def delete_discount(self, *, discount_id: str) -> None:
        """Soft-delete a discount. Idempotent on 404 (already deleted)."""
        with logfire.span("polar.delete_discount", discount_id=discount_id) as span:
            try:
                await self._sdk.discounts.delete(discount_id)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "delete_discount")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "delete_discount")

    async def remove_member(
        self, *, external_customer_id: str, external_id: str
    ) -> None:
        with logfire.span(
            "polar.remove_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
        ) as span:
            try:
                await self._sdk.customers.members.delete_external(
                    external_customer_id,
                    external_id,
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "remove_member")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "remove_member")

    async def list_customer_benefit_grants(
        self, *, customer_id: str
    ) -> list[BenefitGrant]:
        with logfire.span(
            "polar.list_customer_benefit_grants", customer_id=customer_id
        ) as span:
            grants: list[BenefitGrant] = []
            try:
                async for grant in self._sdk.benefit_grants.iter_list(
                    customer_id=customer_id,
                    is_granted=True,
                    page=1,
                    limit=100,
                ):
                    grants.append(grant)
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "list_customer_benefit_grants")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "list_customer_benefit_grants")

            span.set_attribute("grant_count", len(grants))
            return grants

    async def delete_customer(self, *, external_id: str) -> None:
        with logfire.span("polar.delete_customer", external_id=external_id) as span:
            try:
                await self._sdk.customers.delete_external(
                    external_id,
                    anonymize=True,
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "delete_customer")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "delete_customer")

    async def track_event_ingestion(
        self, *, counts: Mapping[UUID, int], cutoff: datetime
    ) -> None:
        cutoff_epoch = int(cutoff.timestamp())
        events: list[EventCreateCustomer | EventCreateExternalCustomer] = [
            EventCreateExternalCustomer(
                name="event_ingestion",
                external_customer_id=str(org_id),
                external_id=f"events_ingested-{org_id}-{cutoff_epoch}",
                timestamp=cutoff.isoformat(),
                metadata=cast(EventMetadataInput, {"count": count}),
            )
            for org_id, count in counts.items()
        ]

        with logfire.span(
            "polar.track_event_ingestion",
            org_count=len(events),
            cutoff=cutoff.isoformat(),
        ) as span:
            try:
                await self._sdk.events.ingest(events=events)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "track_event_ingestion")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "track_event_ingestion")

    async def _track_llm_span_usage(
        self,
        *,
        operation: str,
        root_name: str,
        child_name: str,
        external_customer_id: str,
        vendor: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal,
        usage_id: str | None = None,
    ) -> None:
        """Ingest one LLM usage reading as a cost span: a per-customer root
        event plus a child carrying `_llm` and `_cost` (cents) metadata.

        `usage_id` makes the cost-carrying child idempotent: ingestion
        deduplicates on `external_id`, so a task retry after a successful
        ingest with a lost response doesn't double-count the cost.
        """
        total_tokens = input_tokens + output_tokens
        cost_cents = (cost_usd * Decimal(100)).quantize(Decimal("0.000001"))
        root_external_id = f"{root_name}-{external_customer_id}"
        child_external_id = f"{child_name}-{usage_id}" if usage_id else None

        with logfire.span(
            f"polar.{operation}",
            external_customer_id=external_customer_id,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=str(cost_usd),
        ) as span:
            try:
                await self._sdk.events.ingest(
                    events=[
                        EventCreateExternalCustomer(
                            name=root_name,
                            external_customer_id=external_customer_id,
                            external_id=root_external_id,
                        ),
                        EventCreateExternalCustomer(
                            name=child_name,
                            external_customer_id=external_customer_id,
                            external_id=child_external_id,
                            parent_id=root_external_id,
                            metadata={
                                "_llm": LLMMetadata(
                                    vendor=vendor,
                                    model=model,
                                    input_tokens=input_tokens,
                                    output_tokens=output_tokens,
                                    total_tokens=total_tokens,
                                ),
                                "_cost": CostMetadataInput(
                                    amount=str(cost_cents),
                                    currency="usd",
                                ),
                            },
                        ),
                    ]
                )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, operation)
            except PolarNetworkError as e:
                _raise_network_error(span, e, operation)

    async def track_organization_review_usage(
        self,
        *,
        external_customer_id: str,
        review_context: str,
        vendor: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal,
    ) -> None:
        await self._track_llm_span_usage(
            operation="track_organization_review_usage",
            root_name="organization_review",
            child_name=f"organization_review.{review_context}",
            external_customer_id=external_customer_id,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
        )

    async def track_compass_assistant_usage(
        self,
        *,
        external_customer_id: str,
        vendor: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal,
        usage_id: str,
    ) -> None:
        await self._track_llm_span_usage(
            operation="track_compass_assistant_usage",
            root_name="compass_assistant",
            child_name="compass_assistant.chat",
            external_customer_id=external_customer_id,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=cost_usd,
            usage_id=usage_id,
        )

    # Customer-portal-scoped operations: create a per-call customer session
    # and act AS THE CUSTOMER. Used for fields the admin API doesn't expose.

    async def _create_portal_sdk(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None,
    ) -> PolarSDK:
        session = await self._sdk.customer_sessions.create(
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        )
        return PolarSDK(session.token, base_url=self._api_url)

    async def portal_get_customer(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None = None,
    ) -> CustomerPortalCustomer:
        with logfire.span(
            "polar.portal.get_customer",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        ) as span:
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    return await portal_sdk.customer_portal.customers.get()
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "polar.portal.get_customer")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.get_customer")

    async def portal_list_payment_methods(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None = None,
    ) -> list[CustomerPaymentMethod]:
        with logfire.span(
            "polar.portal.list_payment_methods",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        ) as span:
            methods: list[CustomerPaymentMethod] = []
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    customers = portal_sdk.customer_portal.customers
                    async for method in customers.iter_list_payment_methods(
                        page=1,
                        limit=100,
                    ):
                        methods.append(method)
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "polar.portal.list_payment_methods")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.list_payment_methods")

            span.set_attribute("payment_method_count", len(methods))
            return methods

    async def portal_delete_payment_method(
        self,
        *,
        external_customer_id: str,
        payment_method_id: str,
        external_member_id: str | None = None,
    ) -> None:
        with logfire.span(
            "polar.portal.delete_payment_method",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
            payment_method_id=payment_method_id,
        ) as span:
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    await portal_sdk.customer_portal.customers.delete_payment_method(
                        payment_method_id
                    )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    raise PolarSelfPaymentMethodNotFound(payment_method_id) from e
                if e.status_code == 400:
                    span.set_attribute("http.status_code", 400)
                    span.set_attribute("error.body", str(getattr(e, "error", e)))
                    raise PolarSelfPaymentMethodInUse(payment_method_id) from e
                _raise_error(span, e, "polar.portal.delete_payment_method")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.delete_payment_method")

    async def portal_create_customer_session(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None = None,
    ) -> str:
        """Create a short-lived customer session token for the mirrored
        Polar billing customer."""
        with logfire.span(
            "polar.portal.create_customer_session",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        ) as span:
            try:
                session = await self._sdk.customer_sessions.create(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                return session.token
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "polar.portal.create_customer_session")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.create_customer_session")

    async def portal_update_customer(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None = None,
        **update: Unpack[CustomerPortalCustomerUpdate],
    ) -> CustomerPortalCustomer:
        with logfire.span(
            "polar.portal.update_customer",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        ) as span:
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    return await portal_sdk.customer_portal.customers.update(**update)
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 422:
                    span.set_attribute("http.status_code", 422)
                    body = str(getattr(e, "error", e))
                    span.set_attribute("error.body", body)
                    raise PolarSelfClientValidationError(body) from e
                _raise_error(span, e, "polar.portal.update_customer")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.update_customer")

    async def portal_list_benefit_grants(
        self,
        *,
        external_customer_id: str,
        external_member_id: str | None = None,
    ) -> list[CustomerBenefitGrant]:
        with logfire.span(
            "polar.portal.list_benefit_grants",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
        ) as span:
            grants: list[CustomerBenefitGrant] = []
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    benefit_grants = portal_sdk.customer_portal.benefit_grants
                    async for grant in benefit_grants.iter_list(
                        page=1,
                        limit=100,
                    ):
                        grants.append(grant)
            except (PolarClientError, PolarServerError) as e:
                _raise_error(span, e, "polar.portal.list_benefit_grants")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.list_benefit_grants")

            span.set_attribute("grant_count", len(grants))
            return grants

    async def portal_update_benefit_grant(
        self,
        *,
        external_customer_id: str,
        benefit_grant_id: str,
        update: CustomerBenefitGrantUpdate,
        external_member_id: str | None = None,
    ) -> CustomerBenefitGrant:
        with logfire.span(
            "polar.portal.update_benefit_grant",
            external_customer_id=external_customer_id,
            external_member_id=external_member_id,
            benefit_grant_id=benefit_grant_id,
        ) as span:
            try:
                portal_sdk = await self._create_portal_sdk(
                    external_customer_id=external_customer_id,
                    external_member_id=external_member_id,
                )
                async with portal_sdk:
                    return await portal_sdk.customer_portal.benefit_grants.update(
                        benefit_grant_id,
                        **update,
                    )
            except (PolarClientError, PolarServerError) as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    raise PolarSelfBenefitGrantNotFound(benefit_grant_id) from e
                if e.status_code == 422:
                    span.set_attribute("http.status_code", 422)
                    body = str(getattr(e, "error", e))
                    span.set_attribute("error.body", body)
                    raise PolarSelfClientValidationError(body) from e
                _raise_error(span, e, "polar.portal.update_benefit_grant")
            except PolarNetworkError as e:
                _raise_network_error(span, e, "polar.portal.update_benefit_grant")


_client: PolarSelfClient | None = None


def get_client() -> PolarSelfClient:
    global _client
    if _client is None:
        _client = PolarSelfClient(
            access_token=settings.POLAR_ACCESS_TOKEN,
            api_url=settings.POLAR_API_URL,
        )
    return _client
