from __future__ import annotations

from datetime import datetime
from typing import Self, Union
from uuid import UUID

import structlog
from pydantic import parse_obj_as

from polar.integrations.github import client as github
from polar.issue.schemas import Author, IssueAndPullRequestBase
from polar.kit.schemas import Schema
from polar.models import Organization, Repository
from polar.models.pull_request import PullRequest as PullRequestModel
from polar.types import JSONAny

log = structlog.get_logger()


# Public API
class PullRequest(Schema):
    id: UUID
    number: int
    title: str
    author: Author | None
    additions: int
    deletions: int
    is_merged: bool
    is_closed: bool

    @classmethod
    def from_db(cls, pr: PullRequestModel) -> Self:
        return cls(
            id=pr.id,
            number=pr.number,
            title=pr.title,
            author=parse_obj_as(Author, pr.author) if pr.author else None,
            additions=pr.additions if pr.additions else 0,
            deletions=pr.deletions if pr.deletions else 0,
            is_merged=pr.is_merged if pr.is_merged else False,
            is_closed=True if pr.issue_closed_at else False,
        )


#
# Internal APIs below
#


# Since we cannot use mixins with Pydantic, we have to redefine
# some of the fields shared between IssueAndPullRequestBase + CreatePullRequest.
# However, we leverage the IssueAndPullRequestBase.get_normalized_github_issue
# method to reduce the amount of reduction to stay DRY-ish.

common_mutable_keys = {
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
    "issue_created_at",
}


class MinimalPullRequestCreate(IssueAndPullRequestBase):
    requested_reviewers: JSONAny
    requested_teams: JSONAny

    is_merged: bool | None

    merged_at: datetime | None
    merge_commit_sha: str | None

    head: JSONAny
    base: JSONAny

    is_draft: bool | None = None

    # TODO: Rename to something like source_created_at
    # So it's the same across the board reflecting the platform source fields
    # and avoiding overriding our internal ones
    issue_created_at: datetime

    __mutable_keys__ = common_mutable_keys | {
        "requested_reviewers",
        "requested_teams",
        "is_merged",
        "merged_at",
        "merge_commit_sha",
        "head",
        "base",
        "issue_created_at",
        "is_draft",
    }

    @classmethod
    def minimal_pull_request_from_github(
        cls,
        pr: github.rest.PullRequestSimple
        | github.rest.PullRequest
        | github.webhooks.PullRequestOpenedPropPullRequest
        | github.webhooks.PullRequest
        | github.webhooks.PullRequestClosedPropPullRequest
        | github.webhooks.PullRequestReopenedPropPullRequest,
        organization: Organization,
        repository: Repository,
    ) -> Self:
        create = cls.get_normalized_github_issue(pr, organization, repository)

        create.requested_reviewers = github.jsonify(pr.requested_reviewers)
        create.requested_teams = github.jsonify(pr.requested_teams)
        create.merged_at = pr.merged_at
        create.merge_commit_sha = pr.merge_commit_sha
        create.head = github.jsonify(pr.head)
        create.base = github.jsonify(pr.base)
        create.is_draft = bool(pr.draft)

        return create


class FullPullRequestCreate(MinimalPullRequestCreate):
    commits: int | None
    additions: int | None
    deletions: int | None
    changed_files: int | None

    review_comments: int | None
    maintainer_can_modify: bool | None
    is_mergeable: bool | None
    mergeable_state: str | None

    merged_by: JSONAny

    __mutable_keys__ = MinimalPullRequestCreate.__mutable_keys__ | {
        "commits",
        "additions",
        "deletions",
        "changed_files",
        "review_comments",
        "maintainer_can_modify",
        "is_mergeable",
        "mergeable_state",
        "merged_by",
    }

    @classmethod
    def full_pull_request_from_github(
        cls,
        pr: github.rest.PullRequest
        | github.webhooks.PullRequestOpenedPropPullRequest
        | github.webhooks.PullRequest
        | github.webhooks.PullRequestClosedPropPullRequest
        | github.webhooks.PullRequestReopenedPropPullRequest,
        organization: Organization,
        repository: Repository,
    ) -> Self:
        create = cls.minimal_pull_request_from_github(pr, organization, repository)

        create.merged_by = github.jsonify(pr.merged_by)

        create.commits = pr.commits
        create.additions = pr.additions
        create.deletions = pr.deletions
        create.changed_files = pr.changed_files

        create.review_comments = pr.review_comments
        create.maintainer_can_modify = pr.maintainer_can_modify
        create.is_mergeable = pr.mergeable
        create.mergeable_state = pr.mergeable_state

        return create


class PullRequestUpdate(FullPullRequestCreate):
    ...


class PullRequestRead(FullPullRequestCreate):
    id: UUID
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True
