import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidDeployment(RecordModel):
    """One applied config: its checksum and what the apply did, in order."""

    __tablename__ = "void_deployments"

    checksum: Mapped[str] = mapped_column(String, nullable=False, index=True)
    variant_id: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    entries: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
