from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    UniqueConstraint,
    and_,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    CompositeProperty,
    Mapped,
    composite,
    declared_attr,
    mapped_column,
    relationship,
)

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID

if TYPE_CHECKING:
    from polar.models import Benefit, Order, Subscription, User


class BenefitGrantScope(TypedDict, total=False):
    subscription: "Subscription"
    order: "Order"


if TYPE_CHECKING:

    class BenefitGrantScopeArgs(TypedDict, total=False):
        subscription_id: UUID
        order_id: UUID

else:

    class BenefitGrantScopeArgs(dict):
        def __init__(
            self, subscription_id: UUID | None = None, order_id: UUID | None = None
        ) -> None:
            d = {}
            if subscription_id is not None:
                d["subscription_id"] = subscription_id
            if order_id is not None:
                d["order_id"] = order_id
            super().__init__(d)

        def __composite_values__(self) -> tuple[UUID | None, UUID | None]:
            return self.get("subscription_id"), self.get("order_id")


class BenefitGrantScopeComparator(CompositeProperty.Comparator[BenefitGrantScopeArgs]):
    def __eq__(self, other: Any) -> ColumnElement[bool]:  # type: ignore[override]
        if not isinstance(other, dict) or other == {}:
            raise ValueError("A non-empty dictionary scope must be provided.")
        clauses = []
        composite_columns = self.__clause_element__().columns
        for key, value in other.items():
            clauses.append(composite_columns[f"{key}_id"] == value.id)
        return and_(*clauses)


class BenefitGrant(RecordModel):
    __tablename__ = "benefit_grants"
    __table_args__ = (
        UniqueConstraint(
            "subscription_id", "user_id", "benefit_id", name="benefit_grants_sbu_key"
        ),
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

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def user(cls) -> Mapped["User"]:
        return relationship("User", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def benefit(cls) -> Mapped["Benefit"]:
        return relationship("Benefit", lazy="raise")

    subscription_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise", back_populates="grants")

    order_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("orders.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def order(cls) -> Mapped["Order | None"]:
        return relationship("Order", lazy="raise")

    scope: Mapped[BenefitGrantScopeArgs] = composite(
        "subscription_id", "order_id", comparator_factory=BenefitGrantScopeComparator
    )

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
