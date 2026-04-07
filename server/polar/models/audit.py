from datetime import datetime
from typing import TYPE_CHECKING, TypedDict
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    pass


class AuditLog(TypedDict, total=False):
    method: str
    path: str
    status: int
    error: str | None
    correlation_id: str | None


class Audit(RecordModel):
    __tablename__ = "auditlogs"

    start_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )

    end_timestamp: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False, index=True
    )

    account_id: Mapped[UUID] = mapped_column(
        Uuid, ForeignKey("accounts.id", ondelete="cascade"), nullable=True
    )

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=True,
        index=True,
    )

    log: Mapped[AuditLog] = mapped_column(JSONB, nullable=False)
