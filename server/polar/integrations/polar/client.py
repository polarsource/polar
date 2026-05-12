from __future__ import annotations

from collections.abc import Mapping
from datetime import datetime
from decimal import Decimal
from typing import TYPE_CHECKING, Any, NoReturn
from uuid import UUID

import httpx
import logfire

from polar.config import settings
from polar.exceptions import PolarError as InternalPolarError

if TYPE_CHECKING:
    from polar_sdk import Polar as PolarSDK
    from polar_sdk.models import (
        BenefitGrant,
        Checkout,
        Customer,
        Member,
        Order,
        Product,
        Subscription,
        SubscriptionProrationBehavior,
    )


class PolarSelfClientError(InternalPolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class PolarSelfClientOperationalError(PolarSelfClientError):
    """Raised for transient/retryable SDK errors (429, 5xx, network)."""


def _import_sdk() -> type[PolarSDK]:
    from polar_sdk import Polar as PolarSDK

    return PolarSDK


def _raise_error(span: Any, error: Any, operation: str) -> NoReturn:
    span.set_attribute("http.status_code", error.status_code)
    span.set_attribute("error.body", str(error.body))
    message = f"{operation} failed with status {error.status_code}"
    if error.status_code == 429 or error.status_code >= 500:
        raise PolarSelfClientOperationalError(message) from error
    raise PolarSelfClientError(message) from error


def _raise_network_error(
    span: Any, exc: httpx.RequestError, operation: str
) -> NoReturn:
    span.set_attribute("error.type", type(exc).__name__)
    raise PolarSelfClientOperationalError(
        f"{operation} failed with network error: {type(exc).__name__}: {exc}"
    ) from exc


class PolarSelfClient:
    def __init__(self, *, access_token: str, api_url: str) -> None:
        cls = _import_sdk()
        self._sdk = cls(
            access_token=access_token or "unconfigured",
            server_url=api_url,
        )

    async def create_customer(
        self,
        *,
        external_id: str,
        name: str,
        owner_external_id: str,
        owner_email: str,
        owner_name: str,
    ) -> Customer:
        from polar_sdk.models import CustomerTeamCreate, MemberOwnerCreate
        from polar_sdk.models.polarerror import PolarError

        with logfire.span("polar.create_customer", external_id=external_id) as span:
            try:
                return await self._sdk.customers.create_async(
                    request=CustomerTeamCreate(
                        email=None,
                        name=name,
                        external_id=external_id,
                        owner=MemberOwnerCreate(
                            email=owner_email,
                            name=owner_name,
                            external_id=owner_external_id,
                        ),
                    )
                )
            except PolarError as e:
                if e.status_code != 409:
                    _raise_error(span, e, "create_customer")
                span.set_attribute("conflict", True)
            except httpx.RequestError as e:
                _raise_network_error(span, e, "create_customer")

            try:
                return await self._sdk.customers.get_external_async(
                    external_id=external_id
                )
            except PolarError as e:
                _raise_error(span, e, "create_customer.fetch_existing")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "create_customer.fetch_existing")

    async def create_free_subscription(
        self, *, external_customer_id: str, product_id: str
    ) -> None:
        from polar_sdk.models import SubscriptionCreateExternalCustomer
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.create_free_subscription",
            external_customer_id=external_customer_id,
            product_id=product_id,
        ) as span:
            try:
                await self._sdk.subscriptions.create_async(
                    request=SubscriptionCreateExternalCustomer(
                        product_id=product_id,
                        external_customer_id=external_customer_id,
                    )
                )
            except PolarError as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "create_free_subscription")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "create_free_subscription")

    async def get_customer_by_external_id(self, external_id: str) -> Customer:
        return await self._sdk.customers.get_external_async(external_id=external_id)

    async def get_customer_by_external_id_or_none(
        self, external_id: str
    ) -> Customer | None:
        from polar_sdk.models.polarerror import PolarError

        try:
            return await self.get_customer_by_external_id(external_id)
        except PolarError as e:
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
        from polar_sdk.models import OrderSortProperty
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.list_customer_orders",
            customer_id=customer_id,
            page=page,
            limit=limit,
        ) as span:
            try:
                response = await self._sdk.orders.list_async(
                    customer_id=customer_id,
                    page=page,
                    limit=limit,
                    sorting=[OrderSortProperty.MINUS_CREATED_AT],
                )
            except PolarError as e:
                _raise_error(span, e, "list_customer_orders")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "list_customer_orders")

            if response is None:
                return [], 0
            items = list(response.result.items)
            total = response.result.pagination.total_count
            span.set_attribute("order_count", len(items))
            span.set_attribute("total_count", total)
            return items, total

    async def get_order(self, *, order_id: str) -> Order | None:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span("polar.get_order", order_id=order_id) as span:
            try:
                return await self._sdk.orders.get_async(id=order_id)
            except PolarError as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return None
                _raise_error(span, e, "get_order")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "get_order")

    async def get_order_invoice(self, *, order_id: str) -> str | None:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span("polar.get_order_invoice", order_id=order_id) as span:
            try:
                invoice = await self._sdk.orders.invoice_async(id=order_id)
            except PolarError as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return None
                _raise_error(span, e, "get_order_invoice")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "get_order_invoice")
            return invoice.url

    async def list_recurring_products(self, *, organization_id: str) -> list[Product]:
        from polar_sdk.models import ProductVisibility
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.list_recurring_products", organization_id=organization_id
        ) as span:
            products: list[Product] = []
            try:
                response = await self._sdk.products.list_async(
                    organization_id=organization_id,
                    is_recurring=True,
                    is_archived=False,
                    visibility=[ProductVisibility.PUBLIC],
                    page=1,
                    limit=100,
                )
                while response is not None:
                    products.extend(response.result.items)
                    response = response.next()
            except PolarError as e:
                _raise_error(span, e, "list_recurring_products")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "list_recurring_products")

            span.set_attribute("product_count", len(products))
            return products

    async def get_active_subscription(
        self, *, external_customer_id: str
    ) -> Subscription | None:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.get_active_subscription",
            external_customer_id=external_customer_id,
        ) as span:
            try:
                response = await self._sdk.subscriptions.list_async(
                    external_customer_id=external_customer_id,
                    active=True,
                    page=1,
                    limit=1,
                )
            except PolarError as e:
                _raise_error(span, e, "get_active_subscription")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "get_active_subscription")

            items = response.result.items if response is not None else []
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
        embed_origin: str | None = None,
    ) -> Checkout:
        from polar_sdk.models import CheckoutCreate
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.create_checkout",
            product_id=product_id,
            external_customer_id=external_customer_id,
            subscription_id=subscription_id,
        ) as span:
            try:
                return await self._sdk.checkouts.create_async(
                    request=CheckoutCreate(
                        products=[product_id],
                        external_customer_id=external_customer_id,
                        subscription_id=subscription_id,
                        customer_ip_address=customer_ip_address,
                        success_url=success_url,
                        embed_origin=embed_origin,
                    )
                )
            except PolarError as e:
                _raise_error(span, e, "create_checkout")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "create_checkout")

    async def update_subscription_product(
        self,
        *,
        subscription_id: str,
        product_id: str,
        proration_behavior: SubscriptionProrationBehavior | None = None,
    ) -> Subscription:
        from polar_sdk.models import SubscriptionUpdateProduct
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.update_subscription_product",
            subscription_id=subscription_id,
            product_id=product_id,
        ) as span:
            try:
                return await self._sdk.subscriptions.update_async(
                    id=subscription_id,
                    subscription_update=SubscriptionUpdateProduct(
                        product_id=product_id,
                        proration_behavior=proration_behavior,
                    ),
                )
            except PolarError as e:
                _raise_error(span, e, "update_subscription_product")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "update_subscription_product")

    async def get_member_by_external_id(
        self, *, external_customer_id: str, external_id: str
    ) -> Member | None:
        return await self._sdk.members.get_member_by_external_id_async(
            external_id=external_id,
            external_customer_id=external_customer_id,
        )

    async def add_member(
        self, *, customer_id: str, email: str, name: str, external_id: str
    ) -> None:
        from polar_sdk.models import MemberCreate
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.add_member",
            customer_id=customer_id,
            external_id=external_id,
        ) as span:
            try:
                await self._sdk.members.create_member_async(
                    request=MemberCreate(
                        customer_id=customer_id,
                        email=email,
                        name=name,
                        external_id=external_id,
                    )
                )
            except PolarError as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "add_member")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "add_member")

    async def remove_member(
        self, *, external_customer_id: str, external_id: str
    ) -> None:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.remove_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
        ) as span:
            try:
                await self._sdk.members.delete_member_by_external_id_async(
                    external_id=external_id,
                    external_customer_id=external_customer_id,
                )
            except PolarError as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "remove_member")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "remove_member")

    async def list_customer_benefit_grants(
        self, *, customer_id: str
    ) -> list[BenefitGrant]:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.list_customer_benefit_grants", customer_id=customer_id
        ) as span:
            grants: list[BenefitGrant] = []
            try:
                response = await self._sdk.benefit_grants.list_async(
                    customer_id=customer_id,
                    is_granted=True,
                    page=1,
                    limit=100,
                )
                while response is not None:
                    grants.extend(response.result.items)
                    response = response.next()
            except PolarError as e:
                _raise_error(span, e, "list_customer_benefit_grants")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "list_customer_benefit_grants")

            span.set_attribute("grant_count", len(grants))
            return grants

    async def delete_customer(self, *, external_id: str) -> None:
        from polar_sdk.models.polarerror import PolarError

        with logfire.span("polar.delete_customer", external_id=external_id) as span:
            try:
                await self._sdk.customers.delete_external_async(
                    external_id=external_id,
                    anonymize=True,
                )
            except PolarError as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "delete_customer")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "delete_customer")

    async def track_event_ingestion(
        self, *, counts: Mapping[UUID, int], cutoff: datetime
    ) -> None:
        from polar_sdk.models import (
            EventCreateCustomer,
            EventCreateExternalCustomer,
            EventsIngest,
        )
        from polar_sdk.models.polarerror import PolarError

        cutoff_epoch = int(cutoff.timestamp())
        events: list[EventCreateCustomer | EventCreateExternalCustomer] = [
            EventCreateExternalCustomer(
                name="event_ingestion",
                external_customer_id=str(org_id),
                external_id=f"events_ingested-{org_id}-{cutoff_epoch}",
                timestamp=cutoff,
                metadata={"count": count},
            )
            for org_id, count in counts.items()
        ]

        with logfire.span(
            "polar.track_event_ingestion",
            org_count=len(events),
            cutoff=cutoff.isoformat(),
        ) as span:
            try:
                await self._sdk.events.ingest_async(request=EventsIngest(events=events))
            except PolarError as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "track_event_ingestion")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "track_event_ingestion")

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
        from polar_sdk.models import (
            CostMetadataInput,
            EventCreateExternalCustomer,
            EventsIngest,
            LLMMetadata,
        )
        from polar_sdk.models.polarerror import PolarError

        total_tokens = input_tokens + output_tokens
        cost_cents = (cost_usd * Decimal(100)).quantize(Decimal("0.000001"))
        root_external_id = f"organization_review-{external_customer_id}"

        with logfire.span(
            "polar.track_organization_review_usage",
            external_customer_id=external_customer_id,
            review_context=review_context,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=str(cost_usd),
        ) as span:
            try:
                await self._sdk.events.ingest_async(
                    request=EventsIngest(
                        events=[
                            EventCreateExternalCustomer(
                                name="organization_review",
                                external_customer_id=external_customer_id,
                                external_id=root_external_id,
                            ),
                            EventCreateExternalCustomer(
                                name=f"organization_review.{review_context}",
                                external_customer_id=external_customer_id,
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
                )
            except PolarError as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "track_organization_review_usage")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "track_organization_review_usage")


_client: PolarSelfClient | None = None


def get_client() -> PolarSelfClient:
    global _client
    if _client is None:
        _client = PolarSelfClient(
            access_token=settings.POLAR_ACCESS_TOKEN,
            api_url=settings.POLAR_API_URL,
        )
    return _client
