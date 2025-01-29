import datetime
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import Model
from polar.kit.metadata import MetadataMixin
from polar.kit.utils import generate_uuid, utc_now

if TYPE_CHECKING:
    from .customer import Customer
    from .organization import Organization


class EventSource(StrEnum):
    system = "system"
    user = "user"


class Event(Model, MetadataMixin):
    __tablename__ = "events"

    id: Mapped[UUID] = mapped_column(Uuid, primary_key=True, default=generate_uuid)
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

    @declared_attr
    def customer(cls) -> Mapped["Customer"]:
        return relationship("Customer", lazy="raise")

    external_customer_id: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")
