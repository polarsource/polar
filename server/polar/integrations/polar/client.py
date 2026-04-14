from __future__ import annotations

from typing import TYPE_CHECKING, Any

import httpx
import structlog

from polar.config import settings
from polar.exceptions import PolarError as InternalPolarError
from polar.logging import Logger

if TYPE_CHECKING:
    from polar_sdk import Polar as PolarSDK
    from polar_sdk.models import Customer, Member

log: Logger = structlog.get_logger()


class PolarSelfClientError(InternalPolarError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


def _import_sdk() -> type[PolarSDK]:
    from polar_sdk import Polar as PolarSDK

    return PolarSDK


class PolarSelfClient:
    def __init__(self, *, access_token: str, api_url: str) -> None:
        cls = _import_sdk()
        self._sdk = cls(
            access_token=access_token or "unconfigured",
            server_url=api_url,
        )

    async def create_customer(self, *, external_id: str, email: str, name: str) -> None:
        from polar_sdk.models import CustomerTeamCreate
        from polar_sdk.models.polarerror import PolarError

        try:
            await self._sdk.customers.create_async(
                request=CustomerTeamCreate(
                    email=email,
                    name=name,
                    external_id=external_id,
                )
            )
        except PolarError as e:
            self._handle_error(e, "create_customer", external_id=external_id)

    async def create_free_subscription(
        self, *, external_customer_id: str, product_id: str
    ) -> None:
        from polar_sdk.models import SubscriptionCreateExternalCustomer
        from polar_sdk.models.polarerror import PolarError

        try:
            await self._sdk.subscriptions.create_async(
                request=SubscriptionCreateExternalCustomer(
                    product_id=product_id,
                    external_customer_id=external_customer_id,
                )
            )
        except PolarError as e:
            self._handle_error(
                e,
                "create_free_subscription",
                external_customer_id=external_customer_id,
            )

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
            self._handle_error(e, "add_member", external_id=external_id)

    async def remove_member(
        self, *, external_customer_id: str, external_id: str
    ) -> None:
        from polar_sdk.models.polarerror import PolarError

        try:
            await self._sdk.members.delete_member_by_external_id_async(
                external_id=external_id,
            )
        except PolarError as e:
            if e.status_code == 404:
                log.debug(
                    "polar_self.not_found",
                    operation="remove_member",
                    external_customer_id=external_customer_id,
                    external_id=external_id,
                )
                return
            self._handle_error(
                e,
                "remove_member",
                external_customer_id=external_customer_id,
                external_id=external_id,
            )

    async def delete_customer(self, *, external_id: str) -> None:
        from polar_sdk.models.polarerror import PolarError

        try:
            await self._sdk.customers.delete_external_async(
                external_id=external_id,
                anonymize=True,
            )
        except PolarError as e:
            if e.status_code == 404:
                log.debug(
                    "polar_self.not_found",
                    operation="delete_customer",
                    external_id=external_id,
                )
                return
            self._handle_error(e, "delete_customer", external_id=external_id)

    async def track_event_ingestion(
        self, *, external_customer_id: str, count: int
    ) -> None:
        from polar_sdk.models import EventCreateExternalCustomer, EventsIngest
        from polar_sdk.models.polarerror import PolarError

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
            self._handle_error(
                e,
                "track_event_ingestion",
                external_customer_id=external_customer_id,
            )

    def _handle_error(self, error: Any, operation: str, **context: str) -> None:
        if error.status_code == 409:
            log.debug(
                "polar_self.conflict",
                operation=operation,
                **context,
            )
            return

        if error.status_code >= 500 or isinstance(error.__cause__, httpx.RequestError):
            raise PolarSelfClientError(str(error)) from error

        log.warning(
            "polar_self.client_error",
            operation=operation,
            status_code=error.status_code,
            body=error.body,
            **context,
        )


_client: PolarSelfClient | None = None


def get_client() -> PolarSelfClient:
    global _client
    if _client is None:
        _client = PolarSelfClient(
            access_token=settings.POLAR_ACCESS_TOKEN,
            api_url=settings.POLAR_API_URL,
        )
    return _client
