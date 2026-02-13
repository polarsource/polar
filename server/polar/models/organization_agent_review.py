from datetime import datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models.organization import Organization


class OrganizationAgentReview(RecordModel):
    """Stores the result of running the AI review agent on an organization."""

    __tablename__ = "organization_agent_reviews"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    report: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    model_used: Mapped[str] = mapped_column(String, nullable=False)
    reviewed_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    def __repr__(self) -> str:
        return (
            f"OrganizationAgentReview(id={self.id}, "
            f"organization_id={self.organization_id})"
        )
