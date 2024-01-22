from uuid import UUID

from sqlalchemy import (
    ForeignKey,
    Integer,
    String,
)
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class AdvertisementCampaign(RecordModel):
    __tablename__ = "advertisement_campaigns"

    subscription_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id"),
        nullable=False,
    )

    subscription_benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_benefits.id"),
        nullable=False,
    )

    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    image_url: Mapped[str] = mapped_column(String)
    image_url_dark: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    text: Mapped[str] = mapped_column(String)
    link_url: Mapped[str] = mapped_column(String)
