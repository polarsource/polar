import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    ColumnElement,
    ForeignKey,
    String,
    Uuid,
    and_,
    exists,
    extract,
    or_,
    select,
)
from sqlalchemy import (
    cast as sqla_cast,
)
from sqlalchemy.orm import (
    Mapped,
    Relationship,
    declared_attr,
    mapped_column,
    relationship,
)
from sqlalchemy.sql.elements import BinaryExpression

from polar.kit.db.models import Model
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import generate_uuid, utc_now

from .customer import Customer

if TYPE_CHECKING:
    from .organization import Organization


class EventSource(StrEnum):
    system = "system"
    user = "user"


class CustomerComparator(Relationship.Comparator[Customer]):
    def __eq__(self, other: Any) -> ColumnElement[bool]:  # type: ignore[override]
        if isinstance(other, Customer):
            clause = Event.customer_id == other.id
            if other.external_id is not None:
                clause |= and_(
                    Event.external_customer_id.is_not(None),
                    Event.external_customer_id == other.external_id,
                )
            return clause

        raise NotImplementedError()

    def is_(self, other: Any) -> BinaryExpression[bool]:
        if other is None:
            return cast(
                BinaryExpression[bool],
                and_(
                    Event.customer_id.is_(None),
                    or_(
                        Event.external_customer_id.is_(None),
                        ~exists(
                            select(1).where(
                                Customer.external_id == Event.external_customer_id
                            )
                        ),
                    ),
                ),
            )

        raise NotImplementedError()

    def is_not(self, other: Any) -> BinaryExpression[bool]:
        if other is None:
            return cast(
                BinaryExpression[bool],
                or_(
                    Event.customer_id.is_not(None),
                    and_(
                        Event.external_customer_id.is_not(None),
                        exists(
                            select(1).where(
                                Customer.external_id == Event.external_customer_id
                            )
                        ),
                    ),
                ),
            )

        raise NotImplementedError()


class Event(Model, MetadataMixin):
    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=generate_uuid)
    ingested_at: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=True
    )
    timestamp: Mapped[datetime.datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now, index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    source: Mapped[EventSource] = mapped_column(
        String, nullable=False, default=EventSource.system, index=True
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id"), nullable=True, index=True
    )

    external_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    @declared_attr
    def customer(cls) -> Mapped[Customer | None]:
        return relationship(
            Customer,
            primaryjoin=(
                "or_("
                "Event.customer_id == Customer.id,"
                "Event.external_customer_id == Customer.external_id,"
                ")"
            ),
            comparator_factory=CustomerComparator,
            lazy="joined",
            viewonly=True,
        )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    _filterable_fields: dict[str, tuple[type[str | int | bool], Any]] = {
        "timestamp": (int, sqla_cast(extract("epoch", timestamp), BigInteger)),
        "name": (str, name),
        "source": (str, source),
    }
