from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, MetaData, Uuid, inspect
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column

from polar.kit.utils import generate_uuid, utc_now

my_metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_N_label)s",
        "uq": "%(table_name)s_%(column_0_N_name)s_key",
        "ck": "%(table_name)s_%(constraint_name)s_check",
        "fk": "%(table_name)s_%(column_0_N_name)s_fkey",
        "pk": "%(table_name)s_pkey",
    }
)


class Model(DeclarativeBase):
    __abstract__ = True

    metadata = my_metadata


class TimestampedModel(Model):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=True
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        onupdate=utc_now,
        nullable=True,
        default=None,
        index=True,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None, index=True
    )

    def set_deleted_at(self) -> None:
        self.deleted_at = utc_now()

    def set_modified(self) -> None:
        self.modified_at = utc_now()


class RecordModel(TimestampedModel):
    __abstract__ = True

    id: MappedColumn[UUID] = mapped_column(
        Uuid, primary_key=True, default=generate_uuid
    )

    def __eq__(self, __value: object) -> bool:
        return isinstance(__value, self.__class__) and self.id == __value.id

    def __hash__(self) -> int:
        return self.id.int

    def __repr__(self) -> str:
        # We do this complex thing because we might be outside a session with
        # an expired object; typically when Sentry tries to serialize the object for
        # error reporting.
        # But basically, we want to show the ID if we have it.
        insp = inspect(self)
        if insp.identity is not None:
            id_value = insp.identity[0]
            return f"{self.__class__.__name__}(id={id_value!r})"
        return f"{self.__class__.__name__}(id=None)"

    @classmethod
    def generate_id(cls) -> UUID:
        return generate_uuid()
