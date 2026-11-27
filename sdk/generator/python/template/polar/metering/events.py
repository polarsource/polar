import typing

import httpx2
import typing_extensions

from polar.metering.errors import (
    IngestRejectedError,
    IngestRetryableError,
    retry_after_response,
)


class CostMetadataInput(typing.TypedDict):
    amount: float | str
    currency: str


class LLMMetadata(typing.TypedDict):
    vendor: str
    model: str
    prompt: typing.NotRequired[str | None]
    response: typing.NotRequired[str | None]
    input_tokens: int
    cached_input_tokens: typing.NotRequired[int]
    output_tokens: int
    total_tokens: int


class EventMetadataInput(
    typing_extensions.TypedDict, extra_items=str | int | float | bool
):
    _cost: typing.NotRequired[CostMetadataInput]
    _llm: typing.NotRequired[LLMMetadata]


class ContextualEventInput(typing.TypedDict):
    name: str
    timestamp: typing.NotRequired[str]
    organization_id: typing.NotRequired[str | None]
    external_id: typing.NotRequired[str | None]
    parent_id: typing.NotRequired[str | None]
    metadata: typing.NotRequired[EventMetadataInput]


class EventCustomerInput(ContextualEventInput):
    customer_id: str
    member_id: typing.NotRequired[str | None]


class EventExternalCustomerInput(ContextualEventInput):
    external_customer_id: str
    external_member_id: typing.NotRequired[str | None]


EventInput: typing.TypeAlias = EventCustomerInput | EventExternalCustomerInput

async def ingest_events(client: httpx2.AsyncClient, events: list[EventInput]) -> None:
    try:
        response = await client.post("/v1/events/ingest", json={"events": events})
    except httpx2.RequestError as error:
        raise IngestRetryableError() from error

    try:
        response.raise_for_status()
    except httpx2.HTTPStatusError as error:
        if response.is_client_error and response.status_code not in (401, 403, 408, 429):
            raise IngestRejectedError(
                rejected_indexes=_refused_indexes(response, len(events))
            ) from error
        raise IngestRetryableError(retry_after=retry_after_response(response)) from error


def _refused_indexes(response: httpx2.Response, batch_size: int) -> set[int] | None:
    """The indexes of the events Polar's validation refuses, when each of its errors
    names one."""
    if response.status_code != 422:
        return None
    try:
        locations = [error["loc"] for error in response.json()["detail"]]
    except (ValueError, KeyError, TypeError):
        return None
    indexes: set[int] = set()
    for location in locations:
        if (
            not isinstance(location, list)
            or len(location) < 3
            or location[:2] != ["body", "events"]
            or type(location[2]) is not int
            or not 0 <= location[2] < batch_size
        ):
            return None
        indexes.add(location[2])
    return indexes or None


__all__ = ["ContextualEventInput", "EventInput", "ingest_events"]
