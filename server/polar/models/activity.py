from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.custom_field.data import CustomFieldDataMixin
from polar.kit.db.models.base import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    from polar.models import BenefitGrant


class ActivityType(StrEnum):
    benefit_granted = "benefit_granted"
    benefit_revoked = "benefit_revoked"
    benefit_created = "benefit_created"
    benefit_updated = "benefit_updated"
    benefit_enabled = "benefit_enabled"
    benefit_disabled = "benefit_disabled"
    benefit_deleted = "benefit_deleted"


class Activity(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "activities"

    type: Mapped[ActivityType] = mapped_column(String, nullable=False, index=True)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    benefit_grant_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("benefit_grants.id"), nullable=False
    )

    @declared_attr
    def benefit_grant(cls) -> Mapped["BenefitGrant"]:
        return relationship("BenefitGrant", lazy="raise")
