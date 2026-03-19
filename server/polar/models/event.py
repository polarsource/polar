import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any, cast
from uuid import UUID

from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    ColumnElement,
    ForeignKey,
    Index,
    String,
    Uuid,
    and_,
    case,
    exists,
    extract,
    literal_column,
    or_,
    select,
)
from sqlalchemy import (
    cast as sql_cast,
)
from sqlalchemy import (
    cast as sqla_cast,
)
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    Relationship,
    column_property,
    declared_attr,
    mapped_column,
    relationship,
)
from sqlalchemy.sql.elements import BinaryExpression

from polar.kit.db.models import Model
from polar.kit.metadata import MetadataMixin, get_nested_metadata_value
from polar.kit.utils import generate_uuid, utc_now

from .customer import Customer
from .member import Member

if TYPE_CHECKING:
    from .event_type import EventType
    from .organization import Organization


class EventSource(StrEnum):
    system = "system"
    user = "user"


class CustomerComparator(Relationship.Comparator[Customer]):
    def __eq__(self, other: Any) -> ColumnElement[bool]:  # type: ignore[override]
        if isinstance(other, Customer):
            clause = Event.customer_id == other.id
            if other.external_id is not None:
                clause = or_(
                    clause,
                    and_(
                        Event.external_customer_id.is_not(None),
                        Event.external_customer_id == other.external_id,
                        Event.organization_id == other.organization_id,
                    ),
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
                                Customer.external_id == Event.external_customer_id,
                                Customer.organization_id == Event.organization_id,
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
                                Customer.external_id == Event.external_customer_id,
                                Customer.organization_id == Event.organization_id,
                            )
                        ),
                    ),
                ),
            )

        raise NotImplementedError()


class MemberComparator(Relationship.Comparator[Member]):
    def __eq__(self, other: Any) -> ColumnElement[bool]:  # type: ignore[override]
        if isinstance(other, Member):
            clause = Event.member_id == other.id
            if other.external_id is not None:
                clause = or_(
                    clause,
                    and_(
                        Event.external_member_id.is_not(None),
                        Event.external_member_id == other.external_id,
                        Event.organization_id == other.organization_id,
                    ),
                )
            return clause

        raise NotImplementedError()

    def is_(self, other: Any) -> BinaryExpression[bool]:
        if other is None:
            return cast(
                BinaryExpression[bool],
                and_(
                    Event.member_id.is_(None),
                    or_(
                        Event.external_member_id.is_(None),
                        ~exists(
                            select(1).where(
                                Member.external_id == Event.external_member_id,
                                Member.organization_id == Event.organization_id,
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
                    Event.member_id.is_not(None),
                    and_(
                        Event.external_member_id.is_not(None),
                        exists(
                            select(1).where(
                                Member.external_id == Event.external_member_id,
                                Member.organization_id == Event.organization_id,
                            )
                        ),
                    ),
                ),
            )

        raise NotImplementedError()


class Event(Model, MetadataMixin):
    __tablename__ = "events"
    __table_args__ = (
        Index(
            "ix_events_org_timestamp_id",
            "organization_id",
            literal_column("timestamp DESC"),
            "id",
        ),
        Index(
            "ix_events_organization_external_id_ingested_at_desc",
            "organization_id",
            "external_customer_id",
            literal_column("ingested_at DESC"),
        ),
        Index(
            "ix_events_organization_customer_id_ingested_at_desc",
            "organization_id",
            "customer_id",
            literal_column("ingested_at DESC"),
        ),
        Index(
            "ix_events_external_customer_id_pattern",
            "external_customer_id",
            postgresql_ops={"external_customer_id": "text_pattern_ops"},
        ),
        Index(
            "ix_events_organization_id_source_id",
            "organization_id",
            "source",
            "id",
        ),
        Index(
            "ix_events_organization_id_external_id",
            "organization_id",
            "external_id",
            unique=True,
        ),
        Index(
            "ix_events_org_source_name_external_customer_id_ingested_at",
            "organization_id",
            "source",
            "name",
            "external_customer_id",
            literal_column("ingested_at DESC"),
            postgresql_where="external_customer_id IS NOT NULL",
        ),
        Index(
            "ix_events_org_source_name_customer_id_ingested_at",
            "organization_id",
            "source",
            "name",
            "customer_id",
            literal_column("ingested_at DESC"),
            postgresql_where="customer_id IS NOT NULL",
        ),
        Index(
            "ix_events_org_pending_parent",
            "organization_id",
            "pending_parent_external_id",
            postgresql_where="pending_parent_external_id IS NOT NULL",
        ),
    )

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

    member_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        nullable=True,
        index=True,
    )

    external_member_id: Mapped[str | None] = mapped_column(String, nullable=True)

    external_id: Mapped[str | None] = mapped_column(String, nullable=True)

    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True
    )

    root_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True
    )

    pending_parent_external_id: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    @declared_attr
    def parent(cls) -> Mapped["Event | None"]:
        return relationship(
            "Event",
            foreign_keys="Event.parent_id",
            remote_side="Event.id",
            lazy="raise",
        )

    @declared_attr
    def customer(cls) -> Mapped[Customer | None]:
        return relationship(
            Customer,
            primaryjoin=(
                "or_("
                "Event.customer_id == Customer.id,"
                "and_("
                "Event.external_customer_id == Customer.external_id,"
                "Event.organization_id == Customer.organization_id"
                ")"
                ")"
            ),
            comparator_factory=CustomerComparator,
            lazy="raise",
            viewonly=True,
        )

    resolved_customer_id: Mapped[UUID | str] = column_property(
        case(
            (customer_id.is_not(None), sql_cast(customer_id, String)),
            else_=external_customer_id,
        )
    )

    @declared_attr
    def member(cls) -> Mapped[Member | None]:
        return relationship(
            Member,
            primaryjoin=(
                "or_("
                "foreign(Event.member_id) == Member.id,"
                "and_("
                "foreign(Event.external_member_id) == Member.external_id,"
                "Event.organization_id == Member.organization_id"
                ")"
                ")"
            ),
            comparator_factory=MemberComparator,
            lazy="raise",
            viewonly=True,
        )

    resolved_member_id: Mapped[UUID | str | None] = column_property(
        case(
            (member_id.is_not(None), sql_cast(member_id, String)),
            else_=external_member_id,
        )
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

    event_type_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("event_types.id"), nullable=True, index=True
    )

    @declared_attr
    def event_types(cls) -> Mapped["EventType | None"]:
        return relationship("EventType", lazy="raise")

    @property
    def label(self) -> str:
        if self.source == EventSource.system:
            # Lazy import to avoid a circular dependency
            from polar.event.system import SYSTEM_EVENT_LABELS

            return SYSTEM_EVENT_LABELS.get(self.name, self.name)
        if self.event_types is not None:
            base_label = self.event_types.label
            if self.event_types.label_property_selector:
                dynamic_label = get_nested_metadata_value(
                    self.user_metadata, self.event_types.label_property_selector
                )
                if dynamic_label:
                    return str(dynamic_label)
            return base_label
        return self.name

    @hybrid_property
    def is_meter_credit(self) -> bool:
        return (
            self.source == EventSource.system
            and
            # ⚠️ We don't use `SystemEvent` here to avoid circular imports.
            self.name == "meter.credited"
        )

    @is_meter_credit.inplace.expression
    @classmethod
    def _is_meter_credit_expression(cls) -> ColumnElement[bool]:
        return and_(
            cls.source == EventSource.system,
            # ⚠️ We don't use `SystemEvent` here to avoid circular imports.
            cls.name == "meter.credited",
        )

    _filterable_fields: dict[str, tuple[type[str | int | bool], Any]] = {
        "timestamp": (int, sqla_cast(extract("epoch", timestamp), BigInteger)),
        "name": (str, name),
        "source": (str, source),
    }
