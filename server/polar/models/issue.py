import enum
from datetime import datetime

from sqlalchemy import TIMESTAMP, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedColumn, declared_attr, mapped_column

from polar import signals
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import GUID, StringEnum
from polar.platforms import Platforms
from polar.typing import JSONDict, JSONList


class Platform(enum.Enum):
    GITHUB = "github"


class IssueFields:
    class State(str, enum.Enum):
        OPEN = "open"
        CLOSED = "closed"

    platform: Mapped[Platform] = mapped_column(StringEnum(Platforms), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)

    @declared_attr
    def organization_id(cls) -> MappedColumn[GUID | None]:
        return mapped_column(GUID, ForeignKey("organizations.id"), nullable=True)

    @declared_attr
    def repository_id(cls) -> MappedColumn[GUID | None]:
        return mapped_column(GUID, ForeignKey("repositories.id"), nullable=True)

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

    __mutables__ = {
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
    )

    on_created_signal = signals.issue_created
    on_updated_signal = signals.issue_updated
