import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidActivitySpan(RecordModel):
    """One classified span: a group of events sharing ``group_by``, or a single
    event. The definition it came from lives in the deployment configuration;
    the span carries the two fields it needs to find its events again.

    ``due_at`` is the debounce: set on every touch, cleared once classified.
    Labels never move billed amounts.
    """

    __tablename__ = "void_activity_spans"
    __table_args__ = (
        UniqueConstraint("organization_id", "version_id", "span_key"),
        Index(
            "ix_void_activity_spans_identity_window",
            "organization_id",
            "external_identity_id",
            "last_event_at",
        ),
        Index(
            "ix_void_activity_spans_due_at",
            "due_at",
            postgresql_where="due_at IS NOT NULL",
        ),
    )

    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    span_key: Mapped[str] = mapped_column(String, nullable=False)
    event_name: Mapped[str] = mapped_column(String, nullable=False)
    group_by: Mapped[str] = mapped_column(String, nullable=False)
    external_identity_id: Mapped[str | None] = mapped_column(String, nullable=True)
    external_root_id: Mapped[str | None] = mapped_column(String, nullable=True)
    activity: Mapped[str] = mapped_column(String, nullable=False)
    activity_confidence: Mapped[float | None] = mapped_column(nullable=True)
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
    due_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
