import typing

import typing_extensions


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

__all__ = ["ContextualEventInput", "EventInput"]
