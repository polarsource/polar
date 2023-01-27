import uuid
from enum import Enum
from typing import TYPE_CHECKING, Any

from sqlalchemy import Integer, Unicode
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.engine import Dialect
from sqlalchemy.types import TypeDecorator as _TypeDecorator

if TYPE_CHECKING:  # pragma: no cover
    GUIDTypeDecorator = _TypeDecorator[UUID]
    TypeDecorator = _TypeDecorator[Any]
else:
    GUIDTypeDecorator = _TypeDecorator
    TypeDecorator = _TypeDecorator


class GUID(GUIDTypeDecorator):
    """UUIDs without hyphens.
    Postgres UUID type supports removal of hyphens, but will always store them
    in their standard format including hyphens.
    We want our application input & output of UUIDs to be without hyphens.
    This is achieved by leveraging uuid4().hex at input and processing fetched
    database results accordingly as well.
    """

    impl = UUID
    cache_ok = True

    @staticmethod
    def generate() -> str:
        return uuid.uuid4().hex

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, uuid.UUID):
            return value.hex
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        # TODO: Should we support other dialects? Unused variable now
        if value is None:
            return value
        elif isinstance(value, str):
            return uuid.UUID(value).hex
        elif isinstance(value, uuid.UUID):
            return value.hex
        return value


class EnumType(TypeDecorator):
    def __init__(self, enum_klass: type[Enum], **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.enum_klass = enum_klass

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        if isinstance(value, self.enum_klass):
            return value.value
        return value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        if value is None:
            return value
        return self.enum_klass(value)


class IntEnum(EnumType):
    impl = Integer
    cache_ok = True


class StringEnum(EnumType):
    impl = Unicode
    cache_ok = True
