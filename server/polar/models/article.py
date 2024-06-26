from datetime import datetime
from enum import StrEnum
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.models.organization import Organization
from polar.models.user import User


class ArticleByline(StrEnum):
    user = "user"
    organization = "organization"


class ArticleVisibility(StrEnum):
    public = "public"
    hidden = "hidden"  # visible if you have the link
    private = "private"  # only visible to org members


class Article(RecordModel):
    __tablename__ = "articles"

    __table_args__ = (UniqueConstraint("organization_id", "slug"),)

    slug: Mapped[str] = mapped_column(String(255), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String, nullable=False)
    published_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    byline: Mapped[ArticleByline] = mapped_column(
        StringEnum(ArticleByline), nullable=False, default=ArticleByline.user
    )

    visibility: Mapped[ArticleVisibility] = mapped_column(
        StringEnum(ArticleVisibility), nullable=False, default=ArticleVisibility.private
    )

    user_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("users.id"), nullable=True
    )

    @declared_attr
    def user(cls) -> Mapped[User | None]:
        return relationship(User, lazy="raise")

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False
    )

    @declared_attr
    def organization(cls) -> Mapped[Organization]:
        return relationship(Organization, lazy="raise")

    paid_subscribers_only: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )
    paid_subscribers_only_ends_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    notifications_sent_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    notify_subscribers: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    email_sent_to_count: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )
    email_open_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    is_pinned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    og_image_url: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    og_description: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
