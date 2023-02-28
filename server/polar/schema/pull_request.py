from __future__ import annotations

from datetime import datetime
from typing import Any

from polar.clients import github
from polar.ext.sqlalchemy.types import GUID
from polar.platforms import Platforms
from polar.schema.issue import Base, CreateIssue
from polar.typing import JSONDict, JSONList


# Since we cannot use mixins with Pydantic, we have to redefine
# some of the fields shared between CreateIssue + CreatePullRequest.
# However, we leverage the CreateIssue.get_normalized_github_issue
# method to reduce the amount of reduction to stay DRY-ish.
class CreatePullRequest(Base):
    commits: int | None
    additions: int | None
    deletions: int | None
    changed_files: int | None

    requested_reviewers: JSONList | None
    requested_teams: JSONList | None
    is_draft: bool

    is_rebaseable: bool | None

    review_comments: int | None
    maintainer_can_modify: bool | None

    is_mergeable: bool | None
    mergeable_state: str | None
    auto_merge: str | None
    # TODO: Function of merged_at instead?
    # Thereby supporting webhooks + REST API the same despite data differences
    is_merged: bool | None
    merged_by: JSONDict | None
    merged_at: datetime | None
    merge_commit_sha: str | None

    head: JSONDict | None
    base: JSONDict | None
    platform: Platforms
    external_id: int

    organization_id: str | None
    organization_name: str
    repository_id: str | None
    repository_name: str
    number: int

    # TODO: Rename to something like source_created_at
    # So it's the same across the board reflecting the platform source fields
    # and avoiding overriding our internal ones
    issue_created_at: datetime

    @classmethod
    def get_normalized_github_issue(
        cls,
        organization_name: str,
        repository_name: str,
        pr: github.rest.PullRequest
        | github.rest.PullRequestSimple
        | github.webhooks.PullRequestOpenedPropPullRequest,
        organization_id: GUID | None = None,
        repository_id: GUID | None = None,
    ) -> dict[str, Any]:
        normalized = CreateIssue.get_normalized_github_issue(
            organization_name,
            repository_name,
            pr,
            organization_id,
            repository_id,
        )
        merged_by = None
        if hasattr(pr, "merged_by"):
            merged_by = github.jsonify(pr.merged_by)

        normalized.update(
            dict(
                commits=getattr(pr, "commits", None),
                additions=getattr(pr, "additions", None),
                deletions=getattr(pr, "deletions", None),
                changed_files=getattr(pr, "changed_files", None),
                requested_reviewers=github.jsonify(pr.requested_reviewers),
                requested_teams=github.jsonify(pr.requested_teams),
                is_draft=pr.draft,
                is_rebaseable=getattr(pr, "rebaseable", None),
                review_comments=getattr(pr, "review_comments", None),
                maintainer_can_modify=getattr(pr, "maintainer_can_modify", None),
                is_mergeable=getattr(pr, "mergeable", None),
                mergeable_state=getattr(pr, "mergeable_state", None),
                auto_merge=pr.auto_merge,
                merged_by=merged_by,
                merged_at=pr.merged_at,
                merge_commit_sha=pr.merge_commit_sha,
                head=github.jsonify(pr.head),
                base=github.jsonify(pr.base),
            )
        )
        return normalized

    @classmethod
    def from_github(
        cls,
        organization_name: str,
        repository_name: str,
        data: github.wehooks.PullRequestOpened,
        organization_id: GUID | None = None,
        repository_id: GUID | None = None,
    ) -> CreatePullRequest:
        normalized = cls.get_normalized_github_issue(
            organization_name,
            repository_name,
            data,
            organization_id=organization_id,
            repository_id=repository_id,
        )
        return cls(**normalized)


class UpdatePullRequest(CreatePullRequest):
    ...


class PullRequestSchema(CreatePullRequest):
    id: str
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True
