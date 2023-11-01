from uuid import UUID

from sqlalchemy import ForeignKey
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.models.issue import Issue


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

    @declared_attr
    def dependent_issue(cls) -> Mapped[Issue]:
        return relationship(
            Issue,
            uselist=False,
            lazy="raise",
            primaryjoin=Issue.id == cls.dependent_issue_id,
        )

    @declared_attr
    def dependency_issue(cls) -> Mapped[Issue]:
        return relationship(
            Issue,
            uselist=False,
            lazy="raise",
            primaryjoin=Issue.id == cls.dependency_issue_id,
        )
