from typing import Any, cast

import stripe as stripe_lib
from pydantic import BaseModel
from pydantic_extra_types.country import CountryAlpha2
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator

from polar.kit.schemas import EmptyStrToNone


class Address(BaseModel):
    line1: EmptyStrToNone | None = None
    line2: EmptyStrToNone | None = None
    postal_code: EmptyStrToNone | None = None
    city: EmptyStrToNone | None = None
    state: EmptyStrToNone | None = None
    country: CountryAlpha2

    def to_stripe_dict(self) -> stripe_lib.Customer.CreateParamsAddress:
        return cast(
            stripe_lib.Customer.CreateParamsAddress, self.model_dump(exclude_none=True)
        )


class AddressType(TypeDecorator[Any]):
    impl = JSONB
    cache_ok = True

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, Address):
            return value.model_dump_json(exclude_none=True)
        return value

    def process_result_value(self, value: str | None, dialect: Dialect) -> Any:
        if value is not None:
            return Address.model_validate_json(value)
        return value
