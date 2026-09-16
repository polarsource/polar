import uuid
from enum import StrEnum
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, Index, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidDeploymentStatus(StrEnum):
    draft = "draft"
    active = "active"
    archived = "archived"


class VoidDeployment(RecordModel):
    """One configuration version: its hash, what the apply did, and its status.

    An organization has at most one active deployment; activating another one
    archives it. A repeated push of an identical configuration returns the
    existing deployment instead of creating a new one.
    """

    __tablename__ = "void_deployments"
    __table_args__ = (
        Index(
            "ix_void_deployments_one_active_per_organization",
            "organization_id",
            unique=True,
            postgresql_where="status = 'active'",
        ),
    )

    checksum: Mapped[str] = mapped_column(String, nullable=False, index=True)
    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        String, nullable=False, index=True, default=VoidDeploymentStatus.draft
    )
    entries: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False)
    configuration: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, comment="The normalized deploy body; branches fork it."
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    @property
    def is_active(self) -> bool:
        return self.status == VoidDeploymentStatus.active
