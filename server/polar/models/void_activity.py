import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import (
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    String,
    UniqueConstraint,
    Uuid,
)
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidActivity(RecordModel):
    """A span classifier declared by a configuration version.

    Unique by slug within a version, like meters. Labels live on
    ``VoidActivitySpan`` and never move billed amounts.
    """

    __tablename__ = "void_activities"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", "version_id"),
        UniqueConstraint("organization_id", "id"),
    )

    slug: Mapped[str] = mapped_column(String, nullable=False)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    group_by: Mapped[str] = mapped_column(String, nullable=False)
    run_by: Mapped[str | None] = mapped_column(String, nullable=True)
    taxonomy: Mapped[str] = mapped_column(String, nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")


class VoidActivitySpan(RecordModel):
    """One classified span: a ``call_id`` group, or a single event."""

    __tablename__ = "void_activity_spans"
    __table_args__ = (
        UniqueConstraint("organization_id", "version_id", "span_key"),
        ForeignKeyConstraint(
            ["organization_id", "activity_id"],
            ["void_activities.organization_id", "void_activities.id"],
        ),
        Index(
            "ix_void_activity_spans_identity_window",
            "organization_id",
            "external_identity_id",
            "last_event_at",
        ),
    )

    activity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    taxonomy: Mapped[str] = mapped_column(String, nullable=False)
    span_key: Mapped[str] = mapped_column(String, nullable=False)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    external_identity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    external_root_id: Mapped[str | None] = mapped_column(String, nullable=True)
    run_key: Mapped[str | None] = mapped_column(String, nullable=True)
    activity: Mapped[str] = mapped_column(String, nullable=False)
    activity_confidence: Mapped[float | None] = mapped_column(nullable=True)
    activity_probabilities: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True
    )
    waste: Mapped[float | None] = mapped_column(nullable=True)
    cost: Mapped[float | None] = mapped_column(nullable=True)
    input_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    output_tokens: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    event_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    first_event_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    last_event_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    state_hash: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    classified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
