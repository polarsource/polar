import datetime
from uuid import UUID

from sqlalchemy import DATE, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import Model
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.utils import generate_uuid


class Traffic(Model):
    __tablename__ = "traffic"

    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "article_id",
            "date",
            "location_href",
            "referrer",
            # the default generated name is too long (max 63 chars)
            name="traffic_unique_key",
        ),
        Index("article_id", "date"),
        Index("organization_id", "date"),
    )

    id: Mapped[UUID] = mapped_column(
        PostgresUUID, primary_key=True, default=generate_uuid
    )

    article_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("articles.id"), nullable=True
    )

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=True
    )

    date: Mapped[datetime.date] = mapped_column(DATE, nullable=False)

    views: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    location_href: Mapped[str] = mapped_column(String, nullable=True)

    referrer: Mapped[str] = mapped_column(String, nullable=True)
