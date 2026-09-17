import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Any

from sqlalchemy import ForeignKey, String, UniqueConstraint, Uuid
from sqlalchemy.dialects.postgresql import JSONB, TIMESTAMP
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from .organization import Organization


class VoidJudgment(RecordModel):
    """Jev's latest answer to one semantic question about one identity's meter.

    The question lives in the SDK; Polar keeps the answer so repeated polls
    and unchanged windows do not ask Jev again.
    """

    __tablename__ = "void_judgments"
    __table_args__ = (
        UniqueConstraint(
            "organization_id",
            "version_id",
            "external_identity_id",
            "meter_slug",
            "question_hash",
        ),
    )

    version_id: Mapped[str] = mapped_column(String, nullable=False, index=True)
    external_identity_id: Mapped[str] = mapped_column(String, nullable=False)
    meter_slug: Mapped[str] = mapped_column(String, nullable=False)
    question_hash: Mapped[str] = mapped_column(String, nullable=False)
    state_hash: Mapped[str] = mapped_column(String, nullable=False)
    noul: Mapped[float | None] = mapped_column(nullable=True)
    model: Mapped[str | None] = mapped_column(String, nullable=True)
    evidence: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False)
    asked_at: Mapped[datetime] = mapped_column(TIMESTAMP(timezone=True), nullable=False)
    judged_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    organization_id: Mapped[uuid.UUID] = mapped_column(
        Uuid, ForeignKey("organizations.id"), nullable=False, index=True
    )

    organization: Mapped["Organization"] = relationship(lazy="raise")
