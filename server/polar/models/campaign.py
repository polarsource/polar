from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    Integer,
    String,
)
from sqlalchemy.orm import (
    Mapped,
    mapped_column,
)

from polar.kit.db.models import RecordModel
from polar.kit.metadata import MetadataMixin


# Basic campaign structure (alpha)
#
# Intention:
#  - Add referral capabilities (user_id)
#  - Add duration (duration, duration_type: days, gtv)
#  - Add fallback_percent/fixed after campaign completion
class Campaign(MetadataMixin, RecordModel):
    __tablename__ = "campaigns"

    code: Mapped[str] = mapped_column(String, nullable=False, index=True, unique=True)
    name: Mapped[str] = mapped_column(String, nullable=False)

    starts_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    ends_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    max_redemptions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    max_user_redemptions: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=1
    )

    fee_percent: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    fee_fixed: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)
