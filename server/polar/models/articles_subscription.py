from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ForeignKey,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

from .organization import Organization
from .user import User


class ArticlesSubscription(RecordModel):
    __tablename__ = "article_subscriptions"
    __table_args__ = (UniqueConstraint("organization_id", "user_id"),)

    paid_subscriber: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False, index=True
    )

    emails_unsubscribed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def organization(cls) -> Mapped[Organization]:
        return relationship(Organization, lazy="raise")

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped[User]:
        return relationship("User", lazy="raise")
