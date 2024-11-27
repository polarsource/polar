from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.custom_field.data import CustomFieldDataMixin
from polar.kit.db.models.base import RecordModel
from polar.kit.metadata import MetadataMixin

if TYPE_CHECKING:
    pass


class ActivityType(StrEnum):
    lifecycle = "lifecycle"


class Activity(CustomFieldDataMixin, MetadataMixin, RecordModel):
    __tablename__ = "activities"

    type: Mapped[ActivityType] = mapped_column(String, nullable=False, index=True)
    context: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
