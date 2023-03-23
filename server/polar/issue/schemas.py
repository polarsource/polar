from __future__ import annotations
from enum import Enum

from uuid import UUID
from datetime import datetime
from typing import Optional, Self, Type, Union

import structlog

from polar.integrations.github import client as github
from polar.kit.schemas import Schema
from polar.models.issue import Issue
from polar.enums import Platforms
from polar.models.issue_reference import (
    IssueReference,
    ReferenceType,
    ExternalGitHubPullRequestReference as ExternalGitHubPullRequestReferenceModel,
    ExternalGitHubCommitReference as ExternalGitHubCommitReferenceModel,
)
from polar.types import JSONAny

from polar.integrations.github.types import (
    GithubIssue,
    GithubPullRequestFull,
    GithubPullRequestSimple,
)

log = structlog.get_logger()


class Base(Schema):
    platform: Platforms
    external_id: int

    organization_id: UUID
    repository_id: UUID
    number: int

    title: str
    body: str | None
    comments: int | None

    author: JSONAny
    author_association: str | None
    labels: JSONAny
    assignee: JSONAny
    assignees: JSONAny
    milestone: JSONAny
    closed_by: JSONAny
    reactions: JSONAny

    state: Issue.State
    state_reason: str | None

    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime

    __mutable_keys__ = {
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


class IssueCreate(Base):
    @classmethod
    def get_normalized_github_issue(
        cls: Type[Self],
        data: Union[
            GithubIssue,
            GithubPullRequestFull,
            GithubPullRequestSimple,
            github.rest.PullRequestSimple,
            github.rest.PullRequest,
            github.webhooks.PullRequestOpenedPropPullRequest,
            github.webhooks.PullRequest,
            github.webhooks.PullRequestClosedPropPullRequest,
            github.webhooks.PullRequestReopenedPropPullRequest,
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.Issue,
        ],
        organization_id: UUID,
        repository_id: UUID,
    ) -> Self:
        if not data.id:
            raise Exception("no external id set")

        body = data.body if data.body else ""

        ret = cls(
            platform=Platforms.github,
            external_id=data.id,
            organization_id=organization_id,
            repository_id=repository_id,
            number=data.number,
            title=data.title,
            body=body,
            comments=getattr(data, "comments", None),
            author=github.jsonify(data.user),
            author_association=data.author_association,
            labels=github.jsonify(data.labels),
            assignee=github.jsonify(data.assignee),
            assignees=github.jsonify(data.assignees),
            milestone=github.jsonify(data.milestone),
            # TODO: Verify this
            closed_by=github.jsonify(github.attr(data, "closed_by")),
            reactions=github.jsonify(github.attr(data, "reactions")),
            state=Issue.State(data.state),
            state_reason=github.attr(data, "state_reason"),
            issue_closed_at=data.closed_at,
            issue_created_at=data.created_at,
            issue_modified_at=data.updated_at,
        )

        return ret

    @classmethod
    def from_github(
        cls,
        data: Union[
            GithubIssue,
            GithubPullRequestFull,
            GithubPullRequestSimple,
            github.rest.PullRequestSimple,
            github.rest.PullRequest,
            github.webhooks.PullRequestOpenedPropPullRequest,
            github.webhooks.PullRequest,
            github.webhooks.PullRequestClosedPropPullRequest,
            github.webhooks.PullRequestReopenedPropPullRequest,
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.Issue,
        ],
        organization_id: UUID,
        repository_id: UUID,
    ) -> Self:
        return cls.get_normalized_github_issue(
            data,
            organization_id=organization_id,
            repository_id=repository_id,
        )


class IssueUpdate(IssueCreate):
    ...


class IssueRead(IssueCreate):
    id: UUID
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True


class GetIssuePath(Schema):
    organization: str
    repo: str
    number: int


class IssueReferenceType(str, Enum):
    pull_request = "pull_request"
    external_github_pull_request = "external_github_pull_request"
    external_github_commit = "external_github_commit"


class PullRequestReference(Schema):
    id: UUID
    title: str
    author_login: str
    author_avatar: str
    number: int
    organization_name: str
    repository_name: str
    additions: int
    deletions: int
    state: str  # open | closed
    created_at: datetime
    merged_at: datetime | None
    closed_at: datetime | None


class ExternalGitHubPullRequestReference(Schema):
    title: str
    author_login: str
    author_avatar: str
    number: int
    organization_name: str
    repository_name: str
    state: str  # open | closed


class ExternalGitHubCommitReference(Schema):
    author_login: str
    author_avatar: str
    sha: str
    organization_name: str
    repository_name: str


class IssueReferenceRead(Schema):
    id: str
    type: IssueReferenceType
    payload: Union[
        PullRequestReference,
        ExternalGitHubPullRequestReference,
        ExternalGitHubCommitReference,
    ]

    @classmethod
    def from_model(cls, m: IssueReference) -> IssueReferenceRead:
        match m.reference_type:
            case ReferenceType.PULL_REQUEST:
                pr = m.pull_request
                if pr:
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.pull_request,
                        payload=PullRequestReference(
                            id=pr.id,
                            title=pr.title,
                            author_login="xx",
                            author_avatar="xx",
                            number=pr.number,
                            organization_name="org",
                            repository_name="repo",
                            additions=pr.additions or 0,
                            deletions=pr.deletions or 0,
                            state=pr.state,
                            created_at=pr.issue_created_at,
                            merged_at=pr.merged_at,
                            closed_at=pr.issue_closed_at,
                        ),
                    )

            case ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST:
                pr = m.external_source
                if isinstance(pr, ExternalGitHubPullRequestReferenceModel):
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_pull_request,
                        payload=ExternalGitHubPullRequestReference(
                            title=pr.title,
                            author_login=pr.user_login,
                            author_avatar=pr.user_avatar,
                            number=pr.number,
                            organization_name=pr.organization_name,
                            repository_name=pr.repository_name,
                            state=pr.state,
                        ),
                    )

            case ReferenceType.EXTERNAL_GITHUB_COMMIT:
                r = m.external_source
                if isinstance(r, ExternalGitHubCommitReferenceModel):
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_pull_request,
                        payload=ExternalGitHubCommitReference(
                            author_login=r.user_login,
                            author_avatar=r.user_avatar,
                            organization_name=r.organization_name,
                            repository_name=r.repository_name,
                            sha=r.commit_id,
                        ),
                    )

        raise Exception("unable to convert IssueReference to IssueReferenceRead")
