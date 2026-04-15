from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models.base import IDModel
from polar.kit.utils import utc_now


class AuditLog(IDModel):
    __tablename__ = "audit_logs"

    created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, default=utc_now
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="RESTRICT"),
        nullable=False,
    )

    action: Mapped[str] = mapped_column(String, nullable=False)

    resource_type: Mapped[str] = mapped_column(String, nullable=False)
    resource_id: Mapped[UUID] = mapped_column(Uuid, nullable=False)

    actor_type: Mapped[str] = mapped_column(String, nullable=False)
    actor_id: Mapped[UUID | None] = mapped_column(
        Uuid,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    actor_name: Mapped[str | None] = mapped_column(String, nullable=True)

    changes: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    metadata_: Mapped[dict[str, Any] | None] = mapped_column(
        "metadata", JSONB, nullable=True
    )

    ip_address: Mapped[str | None] = mapped_column(String, nullable=True)

    __table_args__ = (
        Index(
            "ix_audit_logs_org_created_id",
            "organization_id",
            created_at.desc(),
            "id",
        ),
        Index(
            "ix_audit_logs_org_resource_type_created",
            "organization_id",
            "resource_type",
            created_at.desc(),
        ),
        Index(
            "ix_audit_logs_actor_created",
            "actor_id",
            created_at.desc(),
        ),
    )
