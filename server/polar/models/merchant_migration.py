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
    # on source_platform: a Stripe restricted API key, a Lemon Squeezy / Paddle
    # API key, etc. Secrets in the blob are encrypted at rest (see EncryptedString
    # in the service).
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

    @property
    def source_connected(self) -> bool:
        """Whether the source provider has been connected (credentials stored)."""
        return bool(self.source_credentials.get("api_key_encrypted"))

    @property
    def source(self) -> dict[str, Any] | None:
        """Non-secret metadata about the connected source, exposed to the API.

        Whitelist the specific public fields rather than dumping the credentials
        blob, so secrets can't leak by accident. The fields vary by provider.
        """
        if not self.source_credentials:
            return None
        return {
            "stripe_user_id": self.source_credentials.get("stripe_user_id"),
            "livemode": self.source_credentials.get("livemode"),
        }
