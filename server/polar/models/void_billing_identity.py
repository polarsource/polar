import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, ForeignKeyConstraint, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidBillingIdentity(RecordModel):
    """A node in a tree keyed by the merchant. A root has no parent and is
    what a customer owns. `metadata` is never read by the billing layer."""

    __tablename__ = "void_identities"
    __table_args__ = (
        UniqueConstraint("organization_id", "id"),
        ForeignKeyConstraint(
            ["organization_id", "parent_id"],
            ["void_identities.organization_id", "void_identities.id"],
            ondelete="restrict",
        ),
        UniqueConstraint("organization_id", "external_id"),
    )

    external_id: Mapped[str] = mapped_column(String, nullable=False)
    parent_id: Mapped[uuid.UUID | None] = mapped_column(
        Uuid,
        nullable=True,
        index=True,
    )
    metadata_: Mapped[dict[str, Any]] = mapped_column(
        "metadata", JSONB, nullable=False, default=dict
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    parent: Mapped["VoidBillingIdentity | None"] = relationship(
        "VoidBillingIdentity",
        remote_side="VoidBillingIdentity.id",
        foreign_keys=[parent_id],
        lazy="raise",
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")

    @property
    def parent_external_id(self) -> str | None:
        return self.parent.external_id if self.parent is not None else None

    @property
    def is_root(self) -> bool:
        return self.parent_id is None
