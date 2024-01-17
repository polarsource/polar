from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class AdvertisementCampaignFormat(StrEnum):
    rect = "rect"
    small_leaderboard = "small_leaderboard"

    def image_size(self) -> tuple[int, int]:
        if self == "rect":
            return (240, 80)
        elif self == "small_leaderboard":
            return (700, 90)
        raise Exception("unrecognised campaign format")


class AdvertisementCampaign(RecordModel):
    __tablename__ = "advertisement_campaigns"

    subscription_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id"),
        nullable=False,
    )

    format: Mapped[AdvertisementCampaignFormat] = mapped_column(String, nullable=False)

    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    image_url: Mapped[str] = mapped_column(String)
    text: Mapped[str] = mapped_column(String)
    link_url: Mapped[str] = mapped_column(String)
