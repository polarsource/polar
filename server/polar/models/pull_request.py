from datetime import datetime

from sqlalchemy import TIMESTAMP, Boolean, Integer, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from polar import signals
from polar.kit.models import RecordModel
from polar.models.issue import IssueFields
from polar.typing import JSONDict, JSONList


class PullRequest(IssueFields, RecordModel):
    __tablename__ = "pull_requests"
    __table_args__ = (
        UniqueConstraint("external_id"),
        UniqueConstraint("organization_id", "repository_id", "number"),
    )

    on_created_signal = signals.pull_request_created
    on_updated_signal = signals.pull_request_updated

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
    is_draft: Mapped[bool] = mapped_column(Boolean, nullable=True)
    is_rebaseable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    review_comments: Mapped[int | None] = mapped_column(Integer, nullable=True)

    maintainer_can_modify: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    is_mergeable: Mapped[bool | None] = mapped_column(Boolean, nullable=True)
    mergeable_state: Mapped[str | None] = mapped_column(String, nullable=True)
    auto_merge: Mapped[str | None] = mapped_column(String, nullable=True)
    is_merged: Mapped[bool] = mapped_column(Boolean, nullable=True)
    merged_by: Mapped[JSONDict | None] = mapped_column(
        JSONB, nullable=True, default=dict
    )
    merged_at: Mapped[datetime | None] = mapped_column(
        TIMESTAMP(timezone=True), nullable=True
    )
    merge_commit_sha: Mapped[str | None] = mapped_column(String, nullable=True)

    # TODO: Storing these for now, but need to trim them down
    head: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=dict)
    base: Mapped[JSONDict | None] = mapped_column(JSONB, nullable=True, default=dict)

    __mutables__ = IssueFields.__mutables__ | {
        "commits",
        "additions",
        "deletions",
        "changed_files",
        "requested_reviewers",
        "requested_teams",
        "is_draft",
        "is_rebaseable",
        "review_comments",
        "maintainer_can_modify",
        "is_mergeable",
        "mergeable_state",
        "auto_merge",
        "is_merged",
        "merged_by",
        "merged_at",
        "merge_commit_sha",
        "head",
        "base",
    }
