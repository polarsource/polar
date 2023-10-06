from typing import TypedDict, Unpack

import httpx
import structlog

from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger

log: Logger = structlog.get_logger()


class LoopsClientError(PolarError):
    def __init__(self, message: str, response: httpx.Response) -> None:
        self.response = response
        super().__init__(message, 500)


class Properties(TypedDict, total=False):
    firstName: str
    lastName: str
    notes: str
    source: str
    userGroup: str
    subscribed: bool
    createdAt: str
    isBacker: bool
    isMaintainer: bool
    gitHubConnected: bool
    firstOrganizationName: str
    organizationInstalled: bool
    repositoryInstalled: bool
    issueBadged: bool


class LoopsClient:
    def __init__(self, api_key: str | None) -> None:
        self.client = httpx.AsyncClient(
            base_url="https://app.loops.so/api/v1",
            headers={"Authorization": f"Bearer {api_key}"},
            # Set a MockTransport if API key is None
            # Basically, we disable Loops request.
            transport=httpx.MockTransport(lambda _: httpx.Response(200))
            if api_key is None
            else None,
        )

    async def create_contact(
        self, email: str, id: str, **properties: Unpack[Properties]
    ) -> None:
        log.debug("create contact on Loops", email=email, id=id, **properties)

        response = await self.client.post(
            "/contacts/create", json={"email": email, "userId": id, **properties}
        )
        self._handle_response(response)

    async def update_contact(
        self, email: str, id: str, **properties: Unpack[Properties]
    ) -> None:
        log.debug("update contact on Loops", email=email, id=id, **properties)

        response = await self.client.post(
            "/contacts/update", json={"email": email, "userId": id, **properties}
        )
        self._handle_response(response)

    async def send_event(
        self, email: str, event_name: str, **properties: Unpack[Properties]
    ) -> None:
        log.debug(
            "send event to Loops", email=email, event_name=event_name, **properties
        )

        response = await self.client.post(
            "/events/send", json={"email": email, "eventName": event_name, **properties}
        )
        self._handle_response(response)

    def _handle_response(self, response: httpx.Response) -> httpx.Response:
        try:
            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            raise LoopsClientError(str(e), e.response) from e
        return response


client = LoopsClient(settings.LOOPS_API_KEY)

__all__ = ["client", "Properties"]
