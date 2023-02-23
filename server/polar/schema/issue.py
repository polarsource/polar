from __future__ import annotations

from datetime import datetime
from typing import Any

from githubkit.utils import Unset, exclude_unset
from polar.exceptions import ExpectedIssueGotPullRequest
from polar.models.issue import Issue
from polar.platforms import Platforms
from polar.schema.base import Schema
from polar.typing import JSONDict, JSONList

from polar.clients import github

# TODO: Ugly. Fix how to deal with githubkit typing at times.
TIssueData = (
    github.rest.Issue
    | github.webhooks.IssuesOpenedPropIssue
    | github.webhooks.PullRequestOpenedPropPullRequest
    | github.rest.PullRequest
    | github.rest.PullRequestSimple
    | github.webhooks.PullRequestOpenedPropPullRequest
)


class Base(Schema):
    platform: Platforms
    external_id: int

    organization_id: str | None
    organization_name: str
    repository_id: str | None
    repository_name: str
    number: int

    title: str
    body: str | None
    comments: int | None

    author: JSONDict | None
    author_association: str | None
    labels: JSONList | None
    assignee: JSONDict | None
    assignees: JSONList | None
    milestone: JSONDict | None
    closed_by: JSONDict | None
    reactions: JSONDict | None

    state: Issue.State
    state_reason: str | None
    is_locked: bool
    lock_reason: str | None

    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime


class CreateIssue(Base):
    # TODO: Merge with BaseSchema once we've gotten rid of token
    token: str

    @classmethod
    def get_normalized_github_issue(
        cls,
        organization_name: str,
        repository_name: str,
        data: TIssueData,
        organization_id: str | None = None,
        repository_id: str | None = None,
    ) -> dict[str, Any]:
        number = data.number

        return dict(
            platform=Platforms.github,
            external_id=data.id,
            organization_id=organization_id,
            organization_name=organization_name,
            repository_id=repository_id,
            repository_name=repository_name,
            number=number,
            title=data.title,
            body=data.body,
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
            state=data.state,
            state_reason=github.attr(data, "state_reason"),
            is_locked=data.locked,
            lock_reason=data.active_lock_reason,
            issue_closed_at=data.closed_at,
            issue_created_at=data.created_at,
            issue_modified_at=data.updated_at,
            token=f"{organization_name}-{repository_name}-{number}",
        )

    @classmethod
    def from_github(
        cls,
        organization_name: str,
        repository_name: str,
        data: TIssueData,
        organization_id: str | None = None,
        repository_id: str | None = None,
    ) -> CreateIssue:
        if github.is_set(data, "pull_request"):
            raise ExpectedIssueGotPullRequest()

        normalized = cls.get_normalized_github_issue(
            organization_name,
            repository_name,
            data,
            organization_id=organization_id,
            repository_id=repository_id,
        )
        return cls(**normalized)


class UpdateIssue(CreateIssue):
    ...


class IssueSchema(CreateIssue):
    id: str
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True

    def get_url(self) -> str:
        if not self.platform == "github":
            raise NotImplementedError(
                f"No implementation for platform: {self.platform}"
            )

        path = f"{self.organization_name}/{self.repository_name}/issues/{self.number}"
        return f"https://github.com/{path}"


class GetIssuePath(Schema):
    organization: str
    repo: str
    number: int
