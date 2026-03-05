from enum import StrEnum
from typing import Any
from uuid import UUID

from sqlalchemy import String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar.enums import EmailSender
from polar.kit.db.models import RecordModel


class EmailLogStatus(StrEnum):
    sent = "sent"
    failed = "failed"


class EmailLog(RecordModel):
    __tablename__ = "email_logs"

    organization_id: Mapped[UUID | None] = mapped_column(
        Uuid, nullable=True, index=True
    )
    status: Mapped[EmailLogStatus] = mapped_column(String, nullable=False, index=True)
    processor: Mapped[EmailSender] = mapped_column(String, nullable=False)
    processor_id: Mapped[str | None] = mapped_column(String, nullable=True)
    to_email_addr: Mapped[str] = mapped_column(String, nullable=False, index=True)
    from_email_addr: Mapped[str] = mapped_column(String, nullable=False)
    from_name: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    email_template: Mapped[str | None] = mapped_column(String, nullable=True)
    email_props: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=False, default=dict
    )
    error: Mapped[str | None] = mapped_column(String, nullable=True)
