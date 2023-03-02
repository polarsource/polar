from __future__ import annotations

import uuid
from datetime import datetime
from typing import Self

import structlog

from polar.clients import github
from polar.schema.issue import CreateIssue
from polar.typing import JSONAny

log = structlog.get_logger()

# Since we cannot use mixins with Pydantic, we have to redefine
# some of the fields shared between CreateIssue + CreatePullRequest.
# However, we leverage the CreateIssue.get_normalized_github_issue
# method to reduce the amount of reduction to stay DRY-ish.


class CreateMinimalPullRequest(CreateIssue):
    requested_reviewers: JSONAny
    requested_teams: JSONAny

    is_merged: bool | None

    merged_at: datetime | None
    merge_commit_sha: str | None

    head: JSONAny
    base: JSONAny

    # TODO: Rename to something like source_created_at
    # So it's the same across the board reflecting the platform source fields
    # and avoiding overriding our internal ones
    issue_created_at: datetime

    @classmethod
    def minimal_pull_request_from_github(
        cls,
        pr: github.rest.PullRequestSimple
        | github.rest.PullRequest
        | github.webhooks.PullRequestOpenedPropPullRequest,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> Self:
        create = cls.get_normalized_github_issue(
            pr,
            organization_id,
            repository_id,
        )

        create.requested_reviewers = github.jsonify(pr.requested_reviewers)
        create.requested_teams = github.jsonify(pr.requested_teams)
        create.merged_at = pr.merged_at
        create.merge_commit_sha = pr.merge_commit_sha
        create.head = github.jsonify(pr.head)
        create.base = github.jsonify(pr.base)

        return create


class CreateFullPullRequest(CreateMinimalPullRequest):
    commits: int | None
    additions: int | None
    deletions: int | None
    changed_files: int | None

    review_comments: int | None
    maintainer_can_modify: bool | None
    is_mergeable: bool | None
    mergeable_state: str | None

    merged_by: JSONAny

    @classmethod
    def full_pull_request_from_github(
        cls,
        pr: github.rest.PullRequest | github.webhooks.PullRequestOpenedPropPullRequest,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> Self:
        create = cls.minimal_pull_request_from_github(
            pr, organization_id, repository_id
        )

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


class UpdatePullRequest(CreateFullPullRequest):
    ...


class PullRequestSchema(CreateFullPullRequest):
    id: str
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True
