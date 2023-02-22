import enum
import uuid
from datetime import datetime

from polar.ext.sqlalchemy import GUID, IntEnum
from polar.models.mixins import ActiveRecordMixin, SerializeMixin
from sqlalchemy import TEXT, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


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

    id: Mapped[uuid.UUID] = mapped_column(GUID, primary_key=True, default=GUID.generate)

    # We use upserts frequently, but would still like to know when a record was
    # created vs. updated.
    #
    # Postgres has `xmax` as a system column containing the row lock in case of updates.
    # For inserts no lock is needed so it's zero (0).
    #
    # https://www.cybertec-postgresql.com/en/whats-in-an-xmax/
    # https://stackoverflow.com/questions/59579151/how-do-i-select-a-postgresql-system-column-using-sqlalchemy
    _xmax: Mapped[str] = mapped_column("xmax", TEXT, system=True)

    @property
    def was_inserted(self) -> bool:
        return self._xmax == 0

    @property
    def was_updated(self) -> bool:
        return self._xmax != 0


class StatusFlag(enum.Enum):
    DISABLED = 0
    ACTIVE = 1


class StatusMixin:
    status: Mapped[int] = mapped_column(
        IntEnum(StatusFlag), nullable=False, default=StatusFlag.DISABLED
    )
