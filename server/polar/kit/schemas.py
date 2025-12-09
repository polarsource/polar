import dataclasses
import json
from collections.abc import Sequence
from datetime import datetime
from typing import Annotated, Any, Literal, cast, get_args, overload

from pydantic import (
    UUID4,
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    GetCoreSchemaHandler,
    GetJsonSchemaHandler,
    HttpUrl,
    PlainSerializer,
)
from pydantic.json_schema import JsonSchemaValue
from pydantic_core import CoreSchema, core_schema
from slugify import slugify


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class IDSchema(Schema):
    id: UUID4 = Field(..., description="The ID of the object.")

    model_config = ConfigDict(
        # IMPORTANT: this ensures FastAPI doesn't generate `-Input` for output schemas
        json_schema_mode_override="serialization",
    )


class TimestampedSchema(Schema):
    created_at: datetime = Field(description="Creation timestamp of the object.")
    modified_at: datetime | None = Field(
        description="Last modification timestamp of the object."
    )


def empty_str_to_none(value: str | None) -> str | None:
    if isinstance(value, str):
        stripped_value = value.strip()
        if stripped_value == "":
            return None
        return stripped_value
    return value


EmptyStrToNoneValidator = AfterValidator(empty_str_to_none)
EmptyStrToNone = Annotated[str | None, EmptyStrToNoneValidator]


def _validate_slug(value: str) -> str:
    slugified = slugify(value)
    if slugified != value:
        raise ValueError(
            "The slug can only contain ASCII letters, numbers and hyphens."
        )
    return value


SlugValidator = AfterValidator(_validate_slug)

UUID4ToStr = Annotated[UUID4, PlainSerializer(lambda v: str(v), return_type=str)]
HttpUrlToStr = Annotated[HttpUrl, PlainSerializer(lambda v: str(v), return_type=str)]


@dataclasses.dataclass(slots=True)
class ClassName:
    """
    Used as an annotation metadata, it allows us to customize the name generated
    by Pydantic for a type; in particular, a long union.

    It does **nothing** on its own, but it can be used by other classes.

    Currently, it's used by `ListResource` to generate a shorter name for the
    OpenAPI schema, when we list a resource having a long union type.
    """

    name: str

    def __hash__(self) -> int:
        return hash(type(self.name))


@dataclasses.dataclass(slots=True)
class MergeJSONSchema:
    json_schema: JsonSchemaValue
    mode: Literal["validation", "serialization"] | None = None

    def __get_pydantic_json_schema__(
        self, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        mode = self.mode or handler.mode
        json_schema = handler(core_schema)
        if mode != handler.mode:
            return json_schema
        return {**json_schema, **self.json_schema}

    def __hash__(self) -> int:
        return hash(type(self.mode))


@dataclasses.dataclass(slots=True)
class SetSchemaReference:
    ref_name: str

    def __get_pydantic_core_schema__(
        self, source_type: Any, handler: GetCoreSchemaHandler
    ) -> CoreSchema:
        schema = handler(source_type)
        schema["ref"] = self.ref_name  # type: ignore
        return schema

    def __hash__(self) -> int:
        return hash(type(self.ref_name))


@dataclasses.dataclass(slots=True)
class SelectorWidget:
    resource_root: str
    resource_name: str
    display_property: str

    def __get_pydantic_json_schema__(
        self, core_schema: core_schema.CoreSchema, handler: GetJsonSchemaHandler
    ) -> JsonSchemaValue:
        json_schema = handler(core_schema)
        return {**json_schema, **self._get_extra_attributes()}

    def _get_extra_attributes(self) -> dict[str, Any]:
        return {
            "x-polar-selector-widget": {
                "resourceRoot": self.resource_root,
                "resourceName": self.resource_name,
                "displayProperty": self.display_property,
            }
        }

    def __hash__(self) -> int:
        return hash(json.dumps(self._get_extra_attributes()))


class MultipleQueryFilter[Q](Sequence[Q]):
    """
    Custom type to handle query filters that can be either
    a single value or a list of values.

    By customizing the schema generation, we can make it accept
    either a scalar or a list of values for the query parameter.

    At runtime, we make sure that the value is always a list.
    """

    def __init__(self, v: Sequence[Q]):
        self.v = v

    @overload
    def __getitem__(self, s: int) -> Q: ...

    @overload
    def __getitem__(self, s: slice) -> Sequence[Q]: ...

    def __getitem__(self, s: int | slice) -> Q | Sequence[Q]:
        return self.v[s]

    def __len__(self) -> int:
        return len(self.v)

    @classmethod
    def __get_pydantic_core_schema__(
        cls, source: Any, handler: GetCoreSchemaHandler
    ) -> core_schema.CoreSchema:
        args = get_args(source)
        if len(args) == 0:
            raise TypeError("QueryFilter requires at least one type argument")

        generic_type = args[0]
        sequence_schema = handler.generate_schema(Sequence[generic_type])  # type: ignore
        scalar_schema = handler.generate_schema(generic_type)
        union_schema = core_schema.union_schema([scalar_schema, sequence_schema])

        return core_schema.no_info_after_validator_function(
            cls._scalar_to_sequence, handler(union_schema)
        )

    @classmethod
    def _scalar_to_sequence(cls, v: Q | Sequence[Q]) -> Sequence[Q]:
        if isinstance(v, Sequence) and not isinstance(v, str):
            return v
        return [cast(Q, v)]  # type: ignore[redundant-cast]


ORGANIZATION_ID_EXAMPLE = "1dbfc517-0bbf-4301-9ba8-555ca42b9737"
PRODUCT_ID_EXAMPLE = "d8dd2de1-21b7-4a41-8bc3-ce909c0cfe23"
PRICE_ID_EXAMPLE = "196ca717-4d84-4d28-a1b8-777255797dbc"
BENEFIT_ID_EXAMPLE = "397a17aa-15cf-4cb4-9333-18040203cf98"
CUSTOMER_ID_EXAMPLE = "992fae2a-2a17-4b7a-8d9e-e287cf90131b"
SUBSCRIPTION_ID_EXAMPLE = "e5149aae-e521-42b9-b24c-abb3d71eea2e"
BENEFIT_GRANT_ID_EXAMPLE = "d322132c-a9d0-4e0d-b8d3-d81ad021a3a9"
METER_ID_EXAMPLE = "d498a884-e2cd-4d3e-8002-f536468a8b22"
CHECKOUT_ID_EXAMPLE = "e4b478fa-cd25-4253-9f1f-8a41e6370ede"
ORDER_ID_EXAMPLE = "57107b74-8400-4d80-a2fc-54c2b4239cb3"
PAYMENT_ID_EXAMPLE = "42b94870-36b9-4573-96b6-b90b1c99a353"
