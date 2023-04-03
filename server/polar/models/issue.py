import enum
from uuid import UUID
from datetime import datetime

from sqlalchemy import (
    TIMESTAMP,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, declared_attr, mapped_column


from polar.issue.signals import issue_created, issue_updated
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum
from polar.enums import Platforms
from polar.types import JSONDict, JSONList

import sqlalchemy as sa
from sqlalchemy_utils.types.ts_vector import TSVectorType


class Platform(enum.Enum):
    GITHUB = "github"


class IssueFields:
    class State(str, enum.Enum):
        OPEN = "open"
        CLOSED = "closed"

    platform: Mapped[Platform] = mapped_column(StringEnum(Platforms), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)

    @declared_attr
    def organization_id(cls) -> MappedColumn[UUID]:
        return mapped_column(
            PostgresUUID, ForeignKey("organizations.id"), nullable=False
        )

    @declared_attr
    def repository_id(cls) -> MappedColumn[UUID]:
        return mapped_column(
            PostgresUUID, ForeignKey("repositories.id"), nullable=False
        )

    number: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True)

    author: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=dict)
    author_association: Mapped[str | None] = mapped_column(String, nullable=True)
    labels: Mapped[JSONList | None] = mapped_column(JSONB, nullable=True, default=list)
    assignee: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    assignees: Mapped[JSONList | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    milestone: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    closed_by: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    reactions: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )

    state: Mapped[str] = mapped_column(StringEnum(State), nullable=False)
    state_reason: Mapped[str | None] = mapped_column(String, nullable=True)

    issue_closed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    issue_created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    issue_modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    title_tsv: Mapped[TSVectorType] = mapped_column(
        TSVectorType("title", regconfig="simple"),
        sa.Computed("to_tsvector('simple', \"title\")", persisted=True),
    )


issue_fields_mutables = {
    "title",
    "body",
    "comments",
    "author",
    "author_association",
    "labels",
    "assignee",
    "assignees",
    "milestone",
    "closed_by",
    "reactions",
    "state",
    "state_reason",
    "issue_closed_at",
    "issue_modified_at",
}


class Issue(IssueFields, RecordModel):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("organization_id", "repository_id", "number"),
        Index(
            "idx_issues_title_tsv", "title_tsv", postgresql_using="gin"
        ),  # Search index
    )

    funding_badge_embedded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )

    on_created_signal = issue_created
    on_updated_signal = issue_updated

    __mutables__ = issue_fields_mutables
