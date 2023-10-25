from datetime import datetime
from uuid import UUID

from sqlalchemy import TIMESTAMP, MetaData
from sqlalchemy.orm import DeclarativeBase, Mapped, MappedColumn, mapped_column

from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import generate_uuid, utc_now

from .mixins import ActiveRecordMixin, SerializeMixin

my_metadata = MetaData(
    naming_convention={
        "ix": "ix_%(column_0_N_label)s",
        "uq": "%(table_name)s_%(column_0_N_name)s_key",
        "ck": "%(table_name)s_%(constraint_name)s_check",
        "fk": "%(table_name)s_%(column_0_N_name)s_fkey",
        "pk": "%(table_name)s_pkey",
    }
)


class Model(DeclarativeBase, ActiveRecordMixin, SerializeMixin):
    __abstract__ = True

    metadata = my_metadata


class TimestampedModel(Model):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), onupdate=utc_now, nullable=True, default=None
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )


class RecordModel(TimestampedModel):
    __abstract__ = True

    id: MappedColumn[UUID] = mapped_column(
        PostgresUUID, primary_key=True, default=generate_uuid
    )
