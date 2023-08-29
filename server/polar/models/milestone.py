from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from sqlalchemy import TIMESTAMP, BigInteger, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class Milestone(RecordModel):
    __tablename__ = "milestones"

    organization_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False
    )

    repository_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID, ForeignKey("repository.id"), nullable=False
    )

    title: Mapped[str] = mapped_column(String(255), nullable=False)

    description: Mapped[str] = mapped_column(String, nullable=False)

    linked_github_milestone_id: Mapped[int | None] = mapped_column(
        Integer, nullable=True
    )

    linked_github_milestone_title: Mapped[str | None] = mapped_column(
        String, nullable=True
    )

    deadline_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    funding_goal: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )
