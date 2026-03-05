from datetime import datetime
from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, Index, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class SentEmailProcessor(StrEnum):
    resend = "resend"


class SentEmail(RecordModel):
    __tablename__ = "sent_emails"

    __table_args__ = (
        Index(
            "ix_sent_emails_idempotency_key",
            "idempotency_key",
            unique=True,
            postgresql_where="idempotency_key IS NOT NULL",
        ),
    )

    type: Mapped[str | None] = mapped_column(String, nullable=True, index=True)
    """EmailTemplate value, if available."""

    processor: Mapped[str | None] = mapped_column(String, nullable=True)
    """Email provider used to send (e.g. 'resend')."""

    processor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    """ID returned by the email provider upon sending."""

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("organizations.id", ondelete="set null"), nullable=True, index=True
    )

    customer_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("customers.id", ondelete="set null"), nullable=True, index=True
    )

    user_id: Mapped[UUID | None] = mapped_column(
        Uuid, ForeignKey("users.id", ondelete="set null"), nullable=True, index=True
    )

    to_email_addr: Mapped[str] = mapped_column(String, nullable=False)

    subject: Mapped[str] = mapped_column(String, nullable=False)

    props: Mapped[dict[str, Any] | None] = mapped_column(JSONB, nullable=True)
    """Template props stored as JSONB for audit trail."""

    idempotency_key: Mapped[str | None] = mapped_column(String, nullable=True)
    """Unique key for deduplication. Partial unique index (WHERE NOT NULL)."""

    sent_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
