from datetime import UTC, datetime
from typing import TYPE_CHECKING, Any, TypedDict
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    Boolean,
    ColumnElement,
    ForeignKey,
    UniqueConstraint,
    Uuid,
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

if TYPE_CHECKING:
    from polar.benefit.strategies import BenefitGrantProperties
    from polar.models import Benefit, Customer, Member, Order, Subscription


class BenefitGrantError(TypedDict):
    message: str
    type: str
    timestamp: str


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
    """
    Represents a benefit granted to a customer or member.

    Unique constraints:
    - benefit_grants_sbc_key: Ensures one grant per (subscription, customer, benefit)
    - benefit_grants_smb_key: Ensures one grant per (subscription, member, benefit)

    These constraints allow both customer-level and member-level benefit grants.
    """

    __tablename__ = "benefit_grants"
    __table_args__ = (
        UniqueConstraint(
            "subscription_id",
            "member_id",
            "benefit_id",
            name="benefit_grants_smb_key",
        ),
    )

    granted_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    revoked_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    customer_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="cascade"), nullable=False, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    member_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("members.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    @declared_attr
    def member(cls) -> Mapped["Member | None"]:
        return relationship("Member", lazy="raise")

    benefit_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("benefits.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def benefit(cls) -> Mapped["Benefit"]:
        return relationship("Benefit", lazy="raise", back_populates="grants")

    subscription_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("subscriptions.id", ondelete="cascade"),
        nullable=True,
        # Don't create an index for subscription_id
        # as it's covered by the unique constraint, being the leading column of it
        index=False,
    )

    @declared_attr
    def subscription(cls) -> Mapped["Subscription | None"]:
        return relationship("Subscription", lazy="raise", back_populates="grants")

    order_id: Mapped[UUID | None] = mapped_column(
        Uuid,
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

    @declared_attr
    def properties(cls) -> Mapped["BenefitGrantProperties"]:
        return mapped_column("properties", JSONB, nullable=False, default=dict)

    @declared_attr
    def error(cls) -> Mapped[BenefitGrantError | None]:
        return mapped_column(
            "error", JSONB(none_as_null=True), nullable=True, default=None
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
        self.error = None

    def set_revoked(self) -> None:
        self.granted_at = None
        self.revoked_at = datetime.now(UTC)

    def set_grant_failed(self, error: Exception) -> None:
        self.granted_at = None
        self.revoked_at = None
        self.error = BenefitGrantError(
            message=str(error),
            type=error.__class__.__name__,
            timestamp=datetime.now(UTC).isoformat(),
        )

    @property
    def previous_properties(self) -> "BenefitGrantProperties | None":
        return getattr(self, "_previous_properties", None)

    @previous_properties.setter
    def previous_properties(self, value: "BenefitGrantProperties") -> None:
        self._previous_properties = value
