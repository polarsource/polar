from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    UniqueConstraint,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Subscription, SubscriptionBenefit, User


class SubscriptionBenefitGrant(RecordModel):
    __tablename__ = "subscription_benefit_grants"
    __table_args__ = (
        UniqueConstraint("subscription_id", "user_id", "subscription_benefit_id"),
    )

    granted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    properties: Mapped[dict[str, Any]] = mapped_column(
        "properties", JSONB, nullable=False, default=dict
    )

    subscription_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription"]:
        return relationship("Subscription", lazy="raise", back_populates="grants")

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    subscription_benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("subscription_benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def subscription_benefit(cls) -> Mapped["SubscriptionBenefit"]:
        return relationship("SubscriptionBenefit", lazy="raise")

    @hybrid_property
    def is_granted(self) -> bool:
        return self.granted_at is not None

    @is_granted.inplace.expression
    @classmethod
    def _is_granted_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.granted_at.is_not(None), Boolean)

    @hybrid_property
    def is_revoked(self) -> bool:
        return self.revoked_at is not None

    @is_revoked.inplace.expression
    @classmethod
    def _is_revoked_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.revoked_at.is_not(None), Boolean)

    def set_granted(self) -> None:
        self.granted_at = datetime.now(UTC)
        self.revoked_at = None

    def set_revoked(self) -> None:
        self.granted_at = None
        self.revoked_at = datetime.now(UTC)
