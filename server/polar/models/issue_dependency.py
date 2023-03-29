import enum
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.schemas import Schema
from sqlalchemy.dialects.postgresql import JSONB

from polar.models.pull_request import PullRequest


class IssueDependency(RecordModel):
    __tablename__ = "issue_dependencies"
    __table_args__ = (UniqueConstraint("dependent_issue_id", "dependency_issue_id"),)

    dependent_issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        nullable=False,
    )

    dependency_issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        nullable=False,
    )
