import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidEntitlement(RecordModel):
    """A boolean feature an identity holds while a granting product is active.

    Unique by slug within the organization; display fields update in place."""

    __tablename__ = "void_entitlements"
    __table_args__ = (UniqueConstraint("organization_id", "slug"),)

    slug: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
