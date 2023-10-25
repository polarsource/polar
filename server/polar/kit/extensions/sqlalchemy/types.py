import uuid
from enum import Enum
from typing import TYPE_CHECKING, Any, cast

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.engine.interfaces import Dialect
from sqlalchemy.types import TypeDecorator as _TypeDecorator

if TYPE_CHECKING:  # pragma: no cover
    GUIDTypeDecorator = _TypeDecorator[UUID]  # type: ignore
    TypeDecorator = _TypeDecorator[Any]
else:
    GUIDTypeDecorator = _TypeDecorator
    TypeDecorator = _TypeDecorator

# See https://github.com/dropbox/sqlalchemy-stubs/issues/94
PostgresUUID = cast(
    "sa.types.TypeEngine[uuid.UUID]",
    UUID(as_uuid=True),
)


class GUID(GUIDTypeDecorator):
    """Legacy - use PostgresUUID instead.

    Keeping this since old migrations reference it.
    """

    impl = UUID
    cache_ok = True


class EnumType(TypeDecorator):
    def __init__(self, enum_klass: type[Enum], **kwargs: Any) -> None:
        super().__init__(**kwargs)
        self.enum_klass = enum_klass

    def process_bind_param(self, value: Any, dialect: Dialect) -> Any:
        return value.value if isinstance(value, self.enum_klass) else value

    def process_result_value(self, value: Any, dialect: Dialect) -> Any:
        return value if value is None else self.enum_klass(value)


class IntEnum(EnumType):
    impl = sa.Integer
    cache_ok = True


class StringEnum(EnumType):
    impl = sa.Unicode
    cache_ok = True
