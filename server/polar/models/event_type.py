from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models.base import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class EventType(RecordModel):
    __tablename__ = "event_types"
    __table_args__ = (
        UniqueConstraint(
            "name",
            "organization_id",
            name="event_types_name_organization_id_key",
        ),
    )

    name: Mapped[str] = mapped_column(String(128), nullable=False, index=True)
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    label_property_selector: Mapped[str | None] = mapped_column(
        String(256), nullable=True
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
