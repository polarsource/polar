import enum
from datetime import datetime
from typing import TYPE_CHECKING, Any, ClassVar
from uuid import UUID

import sqlalchemy
import sqlalchemy as sa
from sqlalchemy import (
    TIMESTAMP,
    BigInteger,
    Boolean,
    ColumnElement,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    type_coerce,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.hybrid import hybrid_property
from sqlalchemy.orm import (
    Mapped,
    MappedAsDataclass,
    MappedColumn,
    declared_attr,
    mapped_column,
    relationship,
)
from sqlalchemy_utils.types.ts_vector import TSVectorType

from polar.enums import Platforms
from polar.kit.db.models import RecordModel
from polar.kit.extensions.sqlalchemy import PostgresUUID, StringEnum
from polar.types import JSONAny

if TYPE_CHECKING:  # pragma: no cover
    from polar.models.issue_reference import IssueReference
    from polar.models.organization import Organization
    from polar.models.pledge import Pledge
    from polar.models.repository import Repository


class IssueFields(MappedAsDataclass, kw_only=True):
    class State(str, enum.Enum):
        OPEN = "open"
        CLOSED = "closed"

    platform: Mapped[Platforms] = mapped_column(StringEnum(Platforms), nullable=False)
    external_id: Mapped[int] = mapped_column(Integer, nullable=False)

    organization_id: MappedColumn[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def organization(cls) -> "Mapped[Organization]":
        return relationship("Organization", lazy="raise", init=False)

    repository_id: "MappedColumn[UUID]" = mapped_column(
        PostgresUUID,
        ForeignKey("repositories.id"),
        nullable=False,
        index=True,
    )

    @declared_attr
    def repository(cls) -> "Mapped[Repository]":
        return relationship("Repository", lazy="raise", init=False)

    number: Mapped[int] = mapped_column(Integer, nullable=False)

    title: Mapped[str] = mapped_column(String, nullable=False)
    body: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    comments: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)

    author: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    author_association: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    labels: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    assignee: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    assignees: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    milestone: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    closed_by: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )
    reactions: Mapped[JSONAny] = mapped_column(
        JSONB(none_as_null=True), nullable=True, default=None
    )

    state: Mapped[str] = mapped_column(StringEnum(State), nullable=False)
    state_reason: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    issue_closed_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    issue_created_at: Mapped[datetime] = mapped_column(
        TIMESTAMP(timezone=True), nullable=False
    )
    issue_modified_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def title_tsv(cls) -> Mapped[TSVectorType]:
        return mapped_column(
            TSVectorType("title", regconfig="simple"),
            sa.Computed("to_tsvector('simple', \"title\")", persisted=True),
            init=False,
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


class Issue(IssueFields, RecordModel, MappedAsDataclass, kw_only=True):
    __tablename__ = "issues"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("platform", "external_lookup_key"),
        UniqueConstraint("organization_id", "repository_id", "number"),
        # Search index
        Index("idx_issues_title_tsv", "title_tsv", postgresql_using="gin"),
        Index(
            "idx_issues_id_closed_at",
            "id",
            "issue_closed_at",
        ),
        Index(
            "idx_issues_pledged_amount_sum",
            "pledged_amount_sum",
        ),
        # TODO: deprecated, remove when we've migrated to positive_reactions_count and
        # total_engagement_count
        Index(
            "idx_issues_reactions_plus_one",
            sqlalchemy.text("((reactions::jsonb ->> 'plus_one')::int)"),
            postgresql_using="btree",
        ),
        Index(
            "idx_issues_positive_reactions_count",
            "positive_reactions_count",
        ),
        Index(
            "idx_issues_positive_total_engagement_count",
            "total_engagement_count",
        ),
    )

    TRANSFERRABLE_PROPERTIES: ClassVar[set[str]] = {
        "pledge_badge_embedded_at",
        "pledge_badge_ever_embedded",
        "has_pledge_badge_label",
        "badge_custom_content",
        "funding_goal",
        "pledged_amount_sum",
        "needs_confirmation_solved",
        "confirmed_solved_at",
        "confirmed_solved_by",
    }

    external_lookup_key: Mapped[str | None] = mapped_column(
        String, nullable=True, index=True, default=None
    )

    pledge_badge_embedded_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    pledge_badge_ever_embedded: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    has_pledge_badge_label: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    badge_custom_content: Mapped[str | None] = mapped_column(
        String,
        nullable=True,
        default=None,
    )

    github_issue_etag: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    github_issue_fetched_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    github_timeline_etag: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    github_timeline_fetched_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    @declared_attr
    def references(cls) -> "Mapped[list[IssueReference]]":
        return relationship("IssueReference", lazy="raise", viewonly=True)

    @declared_attr
    def pledges(cls) -> "Mapped[list[Pledge]]":
        return relationship(
            "Pledge",
            lazy="raise",
            viewonly=True,
        )

    funding_goal: Mapped[int | None] = mapped_column(
        BigInteger, nullable=True, default=None
    )

    # calculated sum of pledges, used for sorting and in Public APIs
    pledged_amount_sum: Mapped[int] = mapped_column(
        BigInteger, nullable=False, default=0
    )

    issue_has_in_progress_relationship: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    issue_has_pull_request_relationship: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default="false"
    )

    positive_reactions_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    total_engagement_count: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )

    needs_confirmation_solved: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False
    )

    confirmed_solved_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )

    confirmed_solved_by: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=True,
        default=None,
    )

    # a number between 0 and 100
    # share of rewards that will go to contributors of this issue
    upfront_split_to_contributors: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    @classmethod
    def contains_pledge_badge_label(cls, labels: Any, pledge_badge_label: str) -> bool:
        if not labels:
            return False

        return any(
            label["name"].lower() == pledge_badge_label.lower() for label in labels
        )

    @hybrid_property
    def closed(self) -> bool:
        return self.issue_closed_at is not None

    @closed.inplace.expression
    @classmethod
    def _closed_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.issue_closed_at != None, Boolean)  # noqa: E711

    @hybrid_property
    def pledge_badge_currently_embedded(self) -> bool:
        return self.pledge_badge_embedded_at is not None

    @pledge_badge_currently_embedded.inplace.expression
    @classmethod
    def _pledge_badge_currently_embedded_expression(cls) -> ColumnElement[bool]:
        return type_coerce(cls.pledge_badge_embedded_at != None, Boolean)  # noqa: E711
