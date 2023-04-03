import enum
from uuid import UUID

from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.schemas import Schema
from sqlalchemy.dialects.postgresql import JSONB

from polar.models.pull_request import PullRequest


class IssueDependency(TimestampedModel):
    __tablename__ = "issue_dependencies"

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("organizations.id"), nullable=False
    )

    repository_id: Mapped[UUID] = mapped_column(
        PostgresUUID, ForeignKey("repositories.id"), nullable=False
    )

    dependent_issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        primary_key=True,
        nullable=False,
    )

    dependency_issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        primary_key=True,
        nullable=False,
    )
