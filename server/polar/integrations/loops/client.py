from typing import TypedDict, Unpack

import httpx
import structlog

from polar.config import settings
from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.logging import Logger

log: Logger = structlog.get_logger()


class Properties(TypedDict, total=False):
    # Loops default properties
    firstName: str
    lastName: str
    notes: str
    source: str
    userGroup: str
    userId: str
    subscribed: bool
    createdAt: str

    # Polar custom properties
    signupIntent: str
    emailLogin: bool
    githubLogin: bool
    googleLogin: bool

    organizationCreated: bool
    organizationSlug: str
    organizationCount: int

    productCreated: bool
    userPatCreated: bool
    webhooksCreated: bool
    lastOrderAt: int

    accountType: AccountType

    # Issue Funding
    githubOrgInstalled: bool
    githubIssueBadged: bool


class LoopsClientError(PolarError): ...


class LoopsClientOperationalError(LoopsClientError):
    def __init__(self, message: str) -> None:
        super().__init__(message)


class LoopsClientLogicalError(LoopsClientError):
    def __init__(self, response: httpx.Response) -> None:
        self.status_code = response.status_code
        self.body = response.text
        message = (
            f"Loops API returned status code {self.status_code} with body: {self.body}"
        )
        super().__init__(message)


class LoopsClient:
    def __init__(self, api_key: str | None) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://app.loops.so/api/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            # Set a MockTransport if API key is None
            # Basically, we disable Loops request.
            transport=(
                httpx.MockTransport(lambda _: httpx.Response(200))
                if api_key is None
                else None
            ),
        )

    async def update_contact(
        self, email: str, id: str, **properties: Unpack[Properties]
    ) -> None:
        log.debug("loops.contact.update", email=email, id=id, **properties)

        await self._make_request(
            self.client.build_request(
                "POST",
                "/contacts/update",
                json={"email": email, "userId": id, **properties},
            )
        )

    async def send_event(
        self,
        email: str,
        event_name: str,
        event_properties: dict[str, str | int | bool] | None = None,
        **contact_properties: Unpack[Properties],
    ) -> None:
        log.debug(
            "loops.events.send",
            email=email,
            event_name=event_name,
            event_properties=event_properties,
            **contact_properties,
        )

        await self._make_request(
            self.client.build_request(
                "POST",
                "/events/send",
                json={
                    "email": email,
                    "eventName": event_name,
                    "eventProperties": event_properties or {},
                    **contact_properties,
                },
            )
        )

    async def _make_request(self, request: httpx.Request) -> httpx.Response:
        try:
            response = await self.client.send(request)
        except httpx.RequestError as e:
            raise LoopsClientOperationalError(str(e)) from e

        if response.is_server_error or response.status_code == 429:
            raise LoopsClientOperationalError(response.text)
        elif response.is_client_error:
            raise LoopsClientLogicalError(response)

        return response


client = LoopsClient(settings.LOOPS_API_KEY)

__all__ = ["Properties", "client"]
