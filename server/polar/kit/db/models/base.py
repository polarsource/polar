from dataclasses import KW_ONLY
from datetime import datetime
from sqlite3 import Timestamp
from uuid import UUID

from sqlalchemy import TIMESTAMP, MetaData
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    MappedAsDataclass,
    MappedColumn,
    mapped_column,
)

from polar.kit.db.models.mixins.active_record import ActiveRecordBase
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
        TIMESTAMP(timezone=True), nullable=False, insert_default=utc_now, default=None
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        onupdate=utc_now,
        nullable=True,
        insert_default=None,
        default=None,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, insert_default=None, default=None
    )


class RecordModel(TimestampedModel):
    __abstract__ = True

    id: MappedColumn[UUID] = mapped_column(
        PostgresUUID, primary_key=True, insert_default=generate_uuid, default=None
    )


#
# Same as above, but mapped as dataclass
#
# All models in the hirarcy must extend MappedAsDataclass
#


class ModelMappedAsDataclass(
    MappedAsDataclass, ActiveRecordBase, DeclarativeBase, kw_only=True
):
    __abstract__ = True

    metadata = my_metadata


class TimestampedModelMappedAsDataclass(ModelMappedAsDataclass, MappedAsDataclass):
    __abstract__ = True

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, insert_default=utc_now, default=None
    )
    modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True),
        onupdate=utc_now,
        nullable=True,
        insert_default=None,
        default=None,
    )
    deleted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, insert_default=None, default=None
    )


class RecordModelMappedAsDataclass(
    TimestampedModelMappedAsDataclass, MappedAsDataclass
):
    __abstract__ = True

    id: MappedColumn[UUID] = mapped_column(
        PostgresUUID, primary_key=True, insert_default=generate_uuid, default=None
    )
