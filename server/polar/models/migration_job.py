from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization


class MigrationSourcePlatform(StrEnum):
    stripe = "stripe"
    lemon_squeezy = "lemon_squeezy"
    paddle = "paddle"


class MigrationJobStatus(StrEnum):
    pending = "pending"
    setup = "setup"
    migrating = "migrating"
    completed = "completed"
    failed = "failed"


class MigrationJob(RecordModel):
    """One migration run for an organization.

    The root record: which billing provider we're migrating from, the current
    status, the credentials to read the source, and the PAN transfer checklist.
    """

    __tablename__ = "migration_jobs"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    source_platform: Mapped[MigrationSourcePlatform] = mapped_column(
        StringEnum(MigrationSourcePlatform, length=32), nullable=False
    )

    status: Mapped[MigrationJobStatus] = mapped_column(
        StringEnum(MigrationJobStatus, length=32),
        nullable=False,
        default=MigrationJobStatus.pending,
    )

    # Stripe OAuth refresh token (rotates on every refresh); plain API key for
    # Lemon Squeezy / Paddle. Encryption at rest is tracked separately.
    source_refresh_token: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )

    # PAN transfer checklist: a list of step objects (step, owner, status,
    # kind, inputs). See the merchant-migrations design doc, Appendix B.
    pan_transfer_steps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
