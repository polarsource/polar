from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, MappedAsDataclass, mapped_column

from polar.kit.db.models import RecordModel
from polar.models.issue import IssueFields
from polar.types import JSONDict, JSONList


class PullRequest(IssueFields, RecordModel, MappedAsDataclass, kw_only=True):
    __tablename__ = "pull_requests"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("organization_id", "repository_id", "number"),
        Index(
            "idx_pull_requests_title_tsv", "title_tsv", postgresql_using="gin"
        ),  # Search index
    )

    # Pull Requests
    commits: Mapped[int | None] = mapped_column(Integer, nullable=True)
    additions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    deletions: Mapped[int | None] = mapped_column(Integer, nullable=True)
    changed_files: Mapped[int | None] = mapped_column(Integer, nullable=True)

    requested_reviewers: Mapped[JSONList | None] = mapped_column(
        JSONB, nullable=True, default=list
    )
    requested_teams: Mapped[JSONList | None] = mapped_column(
        JSONB, nullable=True, default=list
    )

    # Part of Full Pull Request object, must be nullable
    is_draft: Mapped[bool | None] = mapped_column(Boolean, nullable=True, default=None)
    is_rebaseable: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, default=None
    )

    review_comments: Mapped[int | None] = mapped_column(
        Integer, nullable=True, default=None
    )

    maintainer_can_modify: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, default=None
    )

    is_mergeable: Mapped[bool | None] = mapped_column(
        Boolean, nullable=True, default=None
    )
    mergeable_state: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )
    auto_merge: Mapped[str | None] = mapped_column(String, nullable=True, default=None)
    is_merged: Mapped[bool] = mapped_column(Boolean, nullable=True)
    merged_by: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=None
    )
    merged_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True, default=None
    )
    merge_commit_sha: Mapped[str | None] = mapped_column(
        String, nullable=True, default=None
    )

    # TODO: Storing these for now, but need to trim them down
    head: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=None)
    base: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=None)
