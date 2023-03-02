from __future__ import annotations

import uuid
from datetime import datetime
from typing import Self, Type

import structlog

from polar.clients import github
from polar.exceptions import ExpectedIssueGotPullRequest
from polar.ext.sqlalchemy.types import GUID
from polar.models.issue import Issue
from polar.platforms import Platforms
from polar.schema.base import Schema
from polar.typing import JSONAny

# TODO: Ugly. Fix how to deal with githubkit typing at times.
TIssueData = (
    github.rest.Issue
    | github.webhooks.IssuesOpenedPropIssue
    | github.webhooks.PullRequestOpenedPropPullRequest
    | github.rest.PullRequest
    | github.rest.PullRequestSimple
    | github.webhooks.PullRequestOpenedPropPullRequest
)


log = structlog.get_logger()


class Base(Schema):
    platform: Platforms
    external_id: int

    organization_id: str
    repository_id: str
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
    # is_locked: bool
    # lock_reason: str | None

    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime


class CreateIssue(Base):
    @classmethod
    def get_normalized_github_issue(
        cls: Type[Self],
        data: TIssueData,
        organization_id: uuid.UUID,
        repository_id: uuid.UUID,
    ) -> Self:

        log.debug(
            "zegl create.issue",
            organization_id=organization_id,
            ty=type(organization_id),
        )

        ret = cls(
            platform=Platforms.github,
            external_id=data.id,
            organization_id=organization_id.hex,
            repository_id=repository_id.hex,
            number=data.number,
            title=data.title,
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
            # TODO:
            # cls.is_locked = data.locked
            # cls.lock_reason = data.active_lock_reason
            issue_closed_at=data.closed_at,
            issue_created_at=data.created_at,
            issue_modified_at=data.updated_at,
        )

        if data.body:
            cls.body = data.body

        return ret

    @classmethod
    def from_github(
        cls,
        data: TIssueData,
        organization_id: GUID,
        repository_id: GUID,
    ) -> Self:
        if github.is_set(data, "pull_request"):
            raise ExpectedIssueGotPullRequest()

        return cls.get_normalized_github_issue(
            data,
            organization_id=organization_id,
            repository_id=repository_id,
        )


class UpdateIssue(CreateIssue):
    ...


class IssueSchema(CreateIssue):
    id: str
    created_at: datetime
    modified_at: datetime | None

    class Config:
        orm_mode = True

    # def get_url(self) -> str:
    #    if not self.platform == "github":
    #        raise NotImplementedError(
    #            f"No implementation for platform: {self.platform}"
    #        )
    #    path = f"{self.organization_name}/{self.repository_name}/issues/{self.number}"
    #    return f"https://github.com/{path}"


class GetIssuePath(Schema):
    organization: str
    repo: str
    number: int
