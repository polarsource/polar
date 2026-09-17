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
    from .void_activity import VoidActivity


class VoidSense(RecordModel):
    """A deployed Jev noul over labeled activity spend.

    Unique by slug within a version, like activities. Thresholds stay in the
    SDK; Polar stores the question and the latest noul.
    """

    __tablename__ = "void_senses"
    __table_args__ = (
        UniqueConstraint("organization_id", "slug", "version_id"),
        UniqueConstraint("organization_id", "id"),
        ForeignKeyConstraint(
            ["organization_id", "activity_id"],
            ["void_activities.organization_id", "void_activities.id"],
        ),
    )

    slug: Mapped[str] = mapped_column(String, nullable=False)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    activity_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    activity_slug: Mapped[str] = mapped_column(String, nullable=False)
    when: Mapped[str] = mapped_column(String, nullable=False)
    over_type: Mapped[str] = mapped_column(String, nullable=False)
    window_amount: Mapped[int | None] = mapped_column(Integer, nullable=True)
    window_unit: Mapped[str | None] = mapped_column(String, nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
    activity: Mapped["VoidActivity"] = relationship(
        lazy="raise", overlaps="organization"
    )


class VoidSenseObservation(RecordModel):
    """The latest noul for one sense at one identity (and run, when grain is run)."""

    __tablename__ = "void_sense_observations"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "version_id",
            "sense_id",
            "external_identity_id",
            "run_key",
        ),
        ForeignKeyConstraint(
            ["organization_id", "sense_id"],
            ["void_senses.organization_id", "void_senses.id"],
        ),
        Index(
            "ix_void_sense_observations_identity",
            "organization_id",
            "version_id",
            "external_identity_id",
        ),
        Index(
            "ix_void_sense_observations_root",
            "organization_id",
            "version_id",
            "external_root_id",
        ),
    )

    sense_id: Mapped[uuid.UUID] = mapped_column(Uuid, nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    external_identity_id: Mapped[str] = mapped_column(String, nullable=False)
    external_root_id: Mapped[str | None] = mapped_column(String, nullable=True)
    run_key: Mapped[str] = mapped_column(String, nullable=False, default="")
    noul: Mapped[float] = mapped_column(nullable=False)
    state_hash: Mapped[str] = mapped_column(String, nullable=False)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    span_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    cost: Mapped[float | None] = mapped_column(nullable=True)
    mix: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    evaluated_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
    sense: Mapped[VoidSense] = relationship(lazy="raise", overlaps="organization")
