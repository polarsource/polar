import enum
from datetime import datetime

from sqlalchemy import DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from polar.ext.sqlalchemy import GUID, IntEnum
from polar.models.mixins import ActiveRecordMixin, SerializeMixin


class Model(DeclarativeBase, ActiveRecordMixin, SerializeMixin):
    __abstract__ = True


class TimestampedModel(Model):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, default=datetime.utcnow
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        DateTime, onupdate=datetime.utcnow
    )


class RecordModel(TimestampedModel):
    __abstract__ = True

    id: Mapped[GUID] = mapped_column(GUID, primary_key=True, default=GUID.generate)


class StatusFlag(enum.Enum):
    DISABLED = 0
    ACTIVE = 1


class StatusMixin:
    status: Mapped[int] = mapped_column(
        IntEnum(StatusFlag), nullable=False, default=StatusFlag.DISABLED
    )
