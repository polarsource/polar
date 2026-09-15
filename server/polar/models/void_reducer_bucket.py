import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    TIMESTAMP,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    String,
    UniqueConstraint,
    Uuid,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization
    from .void_reducer import VoidReducer


class VoidReducerBucket(RecordModel):
    __tablename__ = "void_reducer_buckets"
    __table_args__ = (
        ForeignKeyConstraint(
            ["organization_id", "reducer_id"],
            ["void_reducers.organization_id", "void_reducers.id"],
        ),
        Index(
            "ix_void_reducer_buckets_last_processed",
            "reducer_id",
            "external_identity_id",
            text("(last_processed_event ->> 'ingested_at') DESC"),
            text("(last_processed_event ->> 'timestamp') DESC"),
            text("(last_processed_event ->> 'external_id') DESC"),
            postgresql_where=text("last_processed_event IS NOT NULL"),
        ),
        UniqueConstraint(
            "reducer_id",
            "external_identity_id",
            "bucket_start",
            postgresql_nulls_not_distinct=True,
        ),
    )

    reducer_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False)
    external_identity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    external_root_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )
    bucket_start: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    data: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)

    # Written in the same upsert as value/data. Null means a legacy result.
    last_processed_event: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    reducer: Mapped["VoidReducer"] = relationship(
        foreign_keys=[reducer_id], lazy="raise"
    )
