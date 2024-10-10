from typing import Any, NotRequired, TypedDict, cast

from pydantic import BaseModel
from pydantic_extra_types.country import CountryAlpha2
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import EmptyStrToNone


class AddressDict(TypedDict):
    line1: NotRequired[str]
    line2: NotRequired[str]
    postal_code: NotRequired[str]
    city: NotRequired[str]
    state: NotRequired[str]
    country: str


class Address(BaseModel):
    line1: EmptyStrToNone | None = None
    line2: EmptyStrToNone | None = None
    postal_code: EmptyStrToNone | None = None
    city: EmptyStrToNone | None = None
    state: EmptyStrToNone | None = None
    country: CountryAlpha2

    def to_dict(self) -> AddressDict:
        return cast(AddressDict, self.model_dump(exclude_none=True))

    def get_unprefixed_state(self) -> str | None:
        if self.state is None:
            return None
        if self.country in {"US", "CA"}:
            return self.state.split("-")[1]
        return self.state


class AddressType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, Address):
            return value.model_dump(exclude_none=True)
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return Address.model_validate(value)
        return value
