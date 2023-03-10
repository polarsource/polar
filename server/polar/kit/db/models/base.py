import enum
from uuid import UUID
from datetime import datetime

from sqlalchemy import TIMESTAMP
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column

from polar.kit.extensions.sqlalchemy import PostgresUUID, IntEnum
from polar.kit.utils import utc_now, generate_uuid

from .mixins import ActiveRecordMixin, SerializeMixin


class Model(DeclarativeBase, ActiveRecordMixin, SerializeMixin):
    __abstract__ = True


class TimestampedModel(Model):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), onupdate=utc_now
    )


class RecordModel(TimestampedModel):
    __abstract__ = True

    id: MappedColumn[UUID] = mapped_column(
        PostgresUUID, primary_key=True, default=generate_uuid
    )


class StatusFlag(enum.Enum):
    DISABLED = 0
    ACTIVE = 1


class StatusMixin:
    status: Mapped[int] = mapped_column(
        IntEnum(StatusFlag), nullable=False, default=StatusFlag.DISABLED
    )
