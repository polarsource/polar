import datetime
import decimal
import typing


JSONValue: typing.TypeAlias = (
    str
    | int
    | float
    | bool
    | None
    | list["JSONValue"]
    | dict[str, "JSONValue"]
)
AttributeValue: typing.TypeAlias = str | int | float | bool


class Money(typing.TypedDict):
    """A monetary amount expressed in major currency units."""

    amount: decimal.Decimal
    currency: str


class TokenUsage(typing.TypedDict):
    """Token counts where cached input is included in input tokens."""

    input_tokens: int
    output_tokens: int
    cache_read_input_tokens: typing.NotRequired[int]
    cache_creation_input_tokens: typing.NotRequired[int]
    reasoning_output_tokens: typing.NotRequired[int]


class LLMMessage(typing.TypedDict):
    role: str
    content: JSONValue


class LLMGeneration(typing.TypedDict):
    kind: typing.Literal["generation"]
    provider: str
    model: str
    usage: TokenUsage
    trace_id: str
    session_id: typing.NotRequired[str]
    operation: typing.NotRequired[str]
    response_model: typing.NotRequired[str]
    input_messages: typing.NotRequired[list[LLMMessage]]
    output_messages: typing.NotRequired[list[LLMMessage]]
    duration_seconds: typing.NotRequired[float]
    time_to_first_token_seconds: typing.NotRequired[float]
    stream: typing.NotRequired[bool]
    http_status_code: typing.NotRequired[int]
    finish_reason: typing.NotRequired[str]
    is_error: typing.NotRequired[bool]
    error: typing.NotRequired[JSONValue]


class Event(typing.TypedDict):
    name: str
    account: str
    id: typing.NotRequired[str]
    parent_id: typing.NotRequired[str]
    occurred_at: typing.NotRequired[datetime.datetime]
    actor: typing.NotRequired[str]
    groups: typing.NotRequired[dict[str, str]]
    attributes: typing.NotRequired[dict[str, AttributeValue]]
    cost: typing.NotRequired[Money]
    llm: typing.NotRequired[LLMGeneration]


__all__ = [
    "AttributeValue",
    "Event",
    "JSONValue",
    "LLMGeneration",
    "LLMMessage",
    "Money",
    "TokenUsage",
]
