import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidOrganizationSettings(RecordModel):
    __tablename__ = "void_organization_settings"

    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, unique=True
    )
    default_variant_id: Mapped[str | None] = mapped_column(String, nullable=True)

    organization: Mapped["Organization"] = relationship(lazy="raise")
