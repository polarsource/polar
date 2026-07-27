from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, Text, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import StringEnum

if TYPE_CHECKING:
    from polar.models.organization import Organization


class OrganizationRiskSignal(RecordModel):
    """A risk signal about an organization, for a human to review.

    Signals come from external sources (Stripe today) and, later, from our own
    review agent. Each row is one finding. The long-term goal is for humans to
    triage these (false positive, investigating, confirmed) and act on them.
    """

    class Source(StrEnum):
        STRIPE = "stripe"

    class Type(StrEnum):
        FRAUDULENT_WEBSITE = "fraudulent_website"
        FRAUDULENT_MERCHANT = "fraudulent_merchant"

    # risk_level is a free-form string so future sources can use their own
    # vocabulary; this is the one value all consumers treat as most severe.
    HIGHEST_RISK_LEVEL = "highest"

    __tablename__ = "organization_risk_signals"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )
    source: Mapped[Source] = mapped_column(StringEnum(Source), nullable=False)
    type: Mapped[Type] = mapped_column(StringEnum(Type), nullable=False)
    risk_level: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
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
