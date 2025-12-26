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
    Select,
    String,
    Uuid,
    and_,
    case,
    event,
    exists,
    extract,
    literal_column,
    or_,
    select,
    update,
)
from sqlalchemy import (
    cast as sql_cast,
)
from sqlalchemy import (
    cast as sqla_cast,
)
from sqlalchemy.dialects.postgresql import insert
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
from polar.kit.metadata import MetadataMixin, extract_metadata_value
from polar.kit.utils import generate_uuid, utc_now

from .customer import Customer

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

    external_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, unique=True
    )

    parent_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True
    )

    root_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("events.id"), nullable=True, index=True
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
                dynamic_label = extract_metadata_value(
                    self.user_metadata, self.event_types.label_property_selector
                )
                if dynamic_label:
                    return dynamic_label
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


class EventClosure(Model):
    __tablename__ = "events_closure"
    __table_args__ = (
        Index(
            "ix_events_closure_ancestor_descendant",
            "ancestor_id",
            "descendant_id",
        ),
        Index(
            "ix_events_closure_descendant_ancestor",
            "descendant_id",
            "ancestor_id",
        ),
    )

    ancestor_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="cascade"),
        primary_key=True,
        nullable=False,
    )

    descendant_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("events.id", ondelete="cascade"),
        primary_key=True,
        nullable=False,
    )

    depth: Mapped[int] = mapped_column(
        BigInteger,
        nullable=False,
        index=True,
    )

    @declared_attr
    def ancestor(cls) -> Mapped[Event]:
        return relationship(
            Event,
            foreign_keys="EventClosure.ancestor_id",
            lazy="raise",
        )

    @declared_attr
    def descendant(cls) -> Mapped[Event]:
        return relationship(
            Event,
            foreign_keys="EventClosure.descendant_id",
            lazy="raise",
        )


# Event listener to populate closure table when events are inserted
@event.listens_for(Event, "after_insert")
def populate_event_closure(mapper: Any, connection: Any, target: Event) -> None:
    """
    Automatically populate the closure table when an event is inserted.
    This ensures the closure table is maintained even when using session.add() directly.
    """
    # Insert self-reference
    connection.execute(
        insert(EventClosure).values(
            ancestor_id=target.id,
            descendant_id=target.id,
            depth=0,
        )
    )

    # If event has a parent, copy parent's ancestors
    if target.parent_id is not None:
        parent_closures: Select[Any] = select(
            EventClosure.ancestor_id,
            literal_column(f"'{target.id}'::uuid").label("descendant_id"),
            (EventClosure.depth + 1).label("depth"),
        ).where(EventClosure.descendant_id == target.parent_id)

        connection.execute(
            insert(EventClosure).from_select(
                ["ancestor_id", "descendant_id", "depth"],
                parent_closures,
            )
        )

    # Set root_id if not already set
    if target.root_id is None:
        if target.parent_id is None:
            # This is a root event
            connection.execute(
                update(Event).where(Event.id == target.id).values(root_id=target.id)
            )
            target.root_id = target.id
        else:
            # Get parent's root_id
            result = connection.execute(
                select(Event.root_id).where(Event.id == target.parent_id)
            )
            parent_root_id = result.scalar_one_or_none()
            root_id = parent_root_id or target.parent_id
            connection.execute(
                update(Event).where(Event.id == target.id).values(root_id=root_id)
            )
            target.root_id = root_id
