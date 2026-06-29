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


class MigrationStep(StrEnum):
    source_setup = "source_setup"
    pre_check = "pre_check"
    create_catalog = "create_catalog"
    copy_cards = "copy_cards"
    activate_subscriptions = "activate_subscriptions"
    cleanup = "cleanup"
    completed = "completed"


class MigrationJob(RecordModel):
    """One migration run for an organization.

    The root of a migration: which provider we import from, how far the run has
    progressed, and the PAN transfer checklist tracking the card move.
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
    step: Mapped[MigrationStep] = mapped_column(
        StringEnum(MigrationStep, length=32),
        nullable=False,
        default=MigrationStep.source_setup,
    )
    # Credential used to read the source provider. For Stripe this is the OAuth
    # refresh token (rotated on every refresh). Encryption at rest is tracked
    # separately (see the KMS secrets RFC).
    source_refresh_token: Mapped[str | None] = mapped_column(
        Text, nullable=True, default=None
    )
    # The PAN transfer checklist: a list of step objects (see PanTransferStep).
    pan_transfer_steps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
