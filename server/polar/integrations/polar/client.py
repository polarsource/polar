from __future__ import annotations

from typing import TYPE_CHECKING, Any, NoReturn

import httpx
import logfire

from polar.config import settings
from polar.exceptions import PolarError as InternalPolarError

if TYPE_CHECKING:
    from polar_sdk import Polar as PolarSDK
    from polar_sdk.models import Customer, Member


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
        self, *, external_id: str, email: str, name: str
    ) -> Customer:
        from polar_sdk.models import CustomerTeamCreate
        from polar_sdk.models.polarerror import PolarError

        with logfire.span("polar.create_customer", external_id=external_id) as span:
            try:
                return await self._sdk.customers.create_async(
                    request=CustomerTeamCreate(
                        email=email,
                        name=name,
                        external_id=external_id,
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

    async def get_member_by_external_id(
        self, *, external_customer_id: str, external_id: str
    ) -> Member | None:
        return await self._sdk.members.get_member_by_external_id_async(
            external_id=external_id,
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
                )
            except PolarError as e:
                if e.status_code == 404:
                    span.set_attribute("not_found", True)
                    return
                _raise_error(span, e, "remove_member")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "remove_member")

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
        self, *, external_customer_id: str, count: int
    ) -> None:
        from polar_sdk.models import EventCreateExternalCustomer, EventsIngest
        from polar_sdk.models.polarerror import PolarError

        with logfire.span(
            "polar.track_event_ingestion",
            external_customer_id=external_customer_id,
            event_count=count,
        ) as span:
            try:
                await self._sdk.events.ingest_async(
                    request=EventsIngest(
                        events=[
                            EventCreateExternalCustomer(
                                name="event_ingestion",
                                external_customer_id=external_customer_id,
                                metadata={"count": count},
                            )
                        ]
                    )
                )
            except PolarError as e:
                if e.status_code == 409:
                    span.set_attribute("conflict", True)
                    return
                _raise_error(span, e, "track_event_ingestion")
            except httpx.RequestError as e:
                _raise_network_error(span, e, "track_event_ingestion")


_client: PolarSelfClient | None = None


def get_client() -> PolarSelfClient:
    global _client
    if _client is None:
        _client = PolarSelfClient(
            access_token=settings.POLAR_ACCESS_TOKEN,
            api_url=settings.POLAR_API_URL,
        )
    return _client
