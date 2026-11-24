from datetime import datetime
from enum import StrEnum
from typing import TYPE_CHECKING, Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, ForeignKey, String, Uuid
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import RecordModel

if TYPE_CHECKING:
    from polar.models import Organization


class AgentSetupStage(StrEnum):
    connect = "connect"
    analyze = "analyze"
    checkout = "checkout"
    products = "products"


class AgentSetupStageStatus(StrEnum):
    in_progress = "in_progress"
    waiting = "waiting"
    done = "done"
    failed = "failed"


class AgentSetupRun(RecordModel):
    __tablename__ = "agent_setup_runs"

    organization_id: Mapped[UUID] = mapped_column(
        Uuid,
        ForeignKey("organizations.id", ondelete="cascade"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> Mapped["Organization"]:
        return relationship("Organization", lazy="raise")

    code_hash: Mapped[str] = mapped_column(String(80), nullable=False, unique=True)
    stages: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    drafts: Mapped[dict[str, Any] | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    approved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
