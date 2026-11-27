from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.merchant_migration.pan_transfer import (
    STEP_STRIPE_COPY,
    PanTransferMethod,
    PanTransferStep,
    PanTransferStepsType,
    stripe_mapping_applied,
)

from .merchant_migration_operation import (
    MerchantMigrationOperation,
    MerchantMigrationOperationType,
)

if TYPE_CHECKING:
    from polar.models.organization import Organization


class MerchantMigrationSourcePlatform(StrEnum):
    stripe = "stripe"
    lemon_squeezy = "lemon_squeezy"
    paddle = "paddle"

    @property
    def label(self) -> str:
        match self:
            case MerchantMigrationSourcePlatform.stripe:
                return "Stripe"
            case MerchantMigrationSourcePlatform.lemon_squeezy:
                return "Lemon Squeezy"
            case MerchantMigrationSourcePlatform.paddle:
                return "Paddle"


class MerchantMigrationStep(StrEnum):
    source_setup = "source_setup"
    pre_check = "pre_check"
    create_catalog = "create_catalog"
    # Lemon Squeezy only: license keys and files become Polar benefits.
    set_up_benefits = "set_up_benefits"
    copy_cards = "copy_cards"
    activate_subscriptions = "activate_subscriptions"
    # Every imported subscription was switched, skipped or failed. Finishing
    # deletes the source key.
    completed = "completed"
    # Closed by Polar after the retention period without activity.
    closed = "closed"


# Sources whose saved cards sit in a Stripe account and can be copied to Polar's.
COPIED_CARD_SOURCES = (
    MerchantMigrationSourcePlatform.stripe,
    MerchantMigrationSourcePlatform.lemon_squeezy,
)

MERCHANT_MIGRATION_FINISHED_STEPS = (
    MerchantMigrationStep.completed,
    MerchantMigrationStep.closed,
)


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
    # The PAN transfer checklist. Empty until the card move starts.
    pan_transfer_steps: Mapped[list[PanTransferStep]] = mapped_column(
        PanTransferStepsType, nullable=False, default=list
    )
    # Background precheck/import state. Null until a run starts.
    operation: Mapped[MerchantMigrationOperation | None] = mapped_column(
        MerchantMigrationOperationType, nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    @property
    def pan_transfer_method(self) -> PanTransferMethod:
        """Stripe and Lemon Squeezy cards are copied Stripe account to Stripe
        account; every other vault goes through a Stripe-coordinated import. A
        checklist already started keeps the method it was built with."""
        started = {step.key for step in self.pan_transfer_steps or []}
        if started:
            if STEP_STRIPE_COPY in started:
                return PanTransferMethod.pan_copy
            return PanTransferMethod.pan_import
        if self.source_platform in COPIED_CARD_SOURCES:
            return PanTransferMethod.pan_copy
        return PanTransferMethod.pan_import

    @property
    def provider_starts_copy(self) -> bool:
        """Whether the source provider, not the merchant, starts the Stripe copy
        from its own Stripe account."""
        return self.source_platform == MerchantMigrationSourcePlatform.lemon_squeezy

    @property
    def exact_card_mapping(self) -> bool:
        """Whether Stripe's copy mapping says which copied card each subscription
        charges. Only a Stripe source stages the payment method a subscription
        charges; other sources match copied cards on brand and last four."""
        return (
            self.source_platform == MerchantMigrationSourcePlatform.stripe
            and stripe_mapping_applied(
                self.pan_transfer_method, self.pan_transfer_steps
            )
        )

    @property
    def source_connected(self) -> bool:
        """Whether the source provider has been connected (credentials stored).

        Completed and closed migrations count as connected: reaching either step
        deletes the key.
        """
        return (
            bool(self.source_credentials.get("api_key_encrypted"))
            or self.step in MERCHANT_MIGRATION_FINISHED_STEPS
        )

    @property
    def source(self) -> dict[str, Any] | None:
        """Non-secret metadata about the connected source, exposed to the API.

        Whitelist the specific public fields rather than dumping the credentials
        blob, so secrets can't leak by accident. The fields vary by provider.
        """
        if not self.source_credentials:
            return None
        if self.source_platform == MerchantMigrationSourcePlatform.lemon_squeezy:
            return {
                "store_id": self.source_credentials.get("store_id"),
                "store_name": self.source_credentials.get("store_name"),
            }
        return {
            "stripe_user_id": self.source_credentials.get("stripe_user_id"),
            "livemode": self.source_credentials.get("livemode"),
            "has_connected_accounts": self.source_credentials.get(
                "has_connected_accounts", False
            ),
        }
