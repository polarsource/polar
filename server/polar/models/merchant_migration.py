from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization


class MerchantMigrationSourcePlatform(StrEnum):
    stripe = "stripe"
    lemon_squeezy = "lemon_squeezy"
    paddle = "paddle"


class MerchantMigrationStep(StrEnum):
    source_setup = "source_setup"
    pre_check = "pre_check"
    create_catalog = "create_catalog"
    copy_cards = "copy_cards"
    activate_subscriptions = "activate_subscriptions"
    cleanup = "cleanup"
    completed = "completed"


class MerchantMigration(RecordModel):
    """One merchant migration to Polar.

    The root of a migration: which provider we import from, how far the run has
    progressed, and the PAN transfer checklist tracking the card move.
    """

    __tablename__ = "merchant_migrations"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source_platform: Mapped[MerchantMigrationSourcePlatform] = mapped_column(
        StringEnum(MerchantMigrationSourcePlatform, length=32), nullable=False
    )
    step: Mapped[MerchantMigrationStep] = mapped_column(
        StringEnum(MerchantMigrationStep, length=32),
        nullable=False,
        default=MerchantMigrationStep.source_setup,
    )
    # Provider-specific credentials used to read the source; the shape depends
    # on source_platform: a Stripe OAuth refresh token, a Lemon Squeezy / Paddle
    # API key, etc. Encryption at rest is tracked separately (see the KMS
    # secrets RFC).
    source_credentials: Mapped[dict[str, Any]] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    # The PAN transfer checklist: a list of step objects (see PanTransferStep).
    pan_transfer_steps: Mapped[list[dict[str, Any]]] = mapped_column(
        JSONB, nullable=False, default=list
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
