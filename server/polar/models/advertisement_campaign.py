from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import User


class AdvertisementCampaign(RecordModel):
    __tablename__ = "advertisement_campaigns"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=False,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    clicks: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    image_url: Mapped[str] = mapped_column(String)
    image_url_dark: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    text: Mapped[str] = mapped_column(String)
    link_url: Mapped[str] = mapped_column(String)
