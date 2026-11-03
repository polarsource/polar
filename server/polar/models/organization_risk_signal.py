from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, Index, String, Text, Uuid, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization


class OrganizationRiskSignal(RecordModel):
    """A risk signal about an organization, for a human to review.

    Signals come from external systems (Stripe) and from our own checks
    (Polar). Each row is one finding; `payload` holds the source-specific
    details. Signals are evidence, not verdicts: recording one never blocks the
    organization on its own.
    """

    class Source(StrEnum):
        STRIPE = "stripe"
        POLAR = "polar"

    class Type(StrEnum):
        FRAUDULENT_WEBSITE = "fraudulent_website"
        FRAUDULENT_MERCHANT = "fraudulent_merchant"
        FLAGGED_PRODUCT_NAME_RENAMED = "flagged_product_name_renamed"
        FLAGGED_PRODUCT_NAME_KEPT = "flagged_product_name_kept"

    class RiskLevel(StrEnum):
        LOW = "low"
        NORMAL = "normal"
        ELEVATED = "elevated"
        HIGHEST = "highest"
        # Not evaluated yet or the evaluation could not complete, e.g. a pending
        # Stripe website evaluation or an unreachable URL.
        UNKNOWN = "unknown"

    __tablename__ = "organization_risk_signals"
    __table_args__ = (
        Index(
            "ix_organization_risk_signals_account_evaluation_id",
            "account_evaluation_id",
            unique=True,
            postgresql_where=text(
                "account_evaluation_id IS NOT NULL AND deleted_at IS NULL"
            ),
        ),
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source: Mapped[Source] = mapped_column(StringEnum(Source), nullable=False)
    type: Mapped[Type] = mapped_column(StringEnum(Type), nullable=False)
    risk_level: Mapped[RiskLevel] = mapped_column(StringEnum(RiskLevel), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    # Stripe's account evaluation id, used to match an asynchronous website
    # evaluation result back to the pending signal.
    account_evaluation_id: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    payload: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"OrganizationRiskSignal(id={self.id}, "
            f"organization_id={self.organization_id}, "
            f"source={self.source}, type={self.type}, risk_level={self.risk_level})"
        )
