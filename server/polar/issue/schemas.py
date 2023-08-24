from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Self, Type, Union
from uuid import UUID

import structlog
from fastapi.encoders import jsonable_encoder
from pydantic import Field, parse_obj_as

from polar.currency.schemas import CurrencyAmount
from polar.dashboard.schemas import IssueStatus
from polar.enums import Platforms
from polar.funding.schemas import Funding
from polar.integrations.github import client as github
from polar.integrations.github.badge import GithubBadge
from polar.kit.schemas import Schema
from polar.models.issue import Issue as IssueModel
from polar.models.issue_reference import (
    ExternalGitHubCommitReference as ExternalGitHubCommitReferenceModel,
)
from polar.models.issue_reference import (
    ExternalGitHubPullRequestReference as ExternalGitHubPullRequestReferenceModel,
)
from polar.models.issue_reference import (
    IssueReference,
    ReferenceType,
)
from polar.organization.schemas import Organization
from polar.repository.schemas import Repository
from polar.types import JSONAny

log = structlog.get_logger()


# Public API
class Reactions(Schema):
    total_count: int
    plus_one: int
    minus_one: int
    laugh: int
    hooray: int
    confused: int
    heart: int
    rocket: int
    eyes: int


class Label(Schema):
    name: str
    color: str


# Public API
class Issue(Schema):
    id: UUID
    platform: Platforms = Field(description="Issue platform (currently always Github)")
    number: int = Field(description="Github #number")
    title: str = Field(description="Github issue title")
    body: str | None = Field(description="Github issue body")
    comments: int | None = Field(
        description="Number of Github comments made on the issue"
    )
    labels: list[Label] = []

    # TODO: Add if needed
    # author: JSONAny
    # author_association: str | None
    # assignee: JSONAny
    # assignees: JSONAny
    # milestone: JSONAny
    # closed_by: JSONAny

    reactions: Reactions | None = Field(description="Github reactions")

    state: Literal["OPEN", "CLOSED"]

    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime

    funding: Funding

    repository: Repository = Field(description="The repository that the issue is in")

    @classmethod
    def from_db(cls, i: IssueModel) -> Self:
        funding = Funding(
            funding_goal=CurrencyAmount(currency="USD", amount=i.funding_goal)
            if i.funding_goal
            else None,
            pledges_sum=CurrencyAmount(currency="USD", amount=i.pledged_amount_sum),
        )

        labels = (
            [
                Label(name=label["name"], color=label["color"])
                for label in i.labels
                if "name" in label and "color" in label
            ]
            if i.labels
            else []
        )

        return cls(
            id=i.id,
            platform=i.platform,
            number=i.number,
            title=i.title,
            body=i.body,
            comments=i.comments,
            state="OPEN" if i.state == IssueModel.State.OPEN else "CLOSED",
            issue_closed_at=i.issue_closed_at,
            issue_modified_at=i.issue_modified_at,
            issue_created_at=i.issue_created_at,
            reactions=parse_obj_as(Reactions, i.reactions) if i.reactions else None,
            funding=funding,
            repository=Repository.from_db(i.repository),
            labels=labels,
        )


class UpdateIssue(Schema):
    funding_goal: CurrencyAmount | None = None


# Public API
class ConfirmIssueSplit(Schema):
    organization_id: UUID | None = None
    github_username: str | None = None
    share_thousands: int


# Public API
class ConfirmIssue(Schema):
    splits: list[ConfirmIssueSplit]


#
# Internal API schemas below
#


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

    state: IssueModel.State
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


class IssueAndPullRequestBase(Base):
    @classmethod
    def get_normalized_github_issue(
        cls: Type[Self],
        data: Union[
            github.rest.Issue,
            github.webhooks.Issue,
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.IssuesReopenedPropIssue,
            github.rest.PullRequest,
            github.rest.PullRequestSimple,
            github.webhooks.PullRequest,
            github.webhooks.PullRequestOpenedPropPullRequest,
            github.webhooks.PullRequestClosedPropPullRequest,
            github.webhooks.PullRequestReopenedPropPullRequest,
        ],
        organization_id: UUID,
        repository_id: UUID,
    ) -> Self:
        """
        normalizes both issues and pull requests
        """

        if not data.id:
            raise Exception("no external id set")

        reactions: Reactions | None = None

        # All issue types have reactions, pull request types does not
        if (
            isinstance(data, github.rest.Issue)
            or isinstance(data, github.webhooks.IssuesOpenedPropIssue)
            or isinstance(data, github.webhooks.IssuesOpenedPropIssue)
            or isinstance(data, github.webhooks.IssuesClosedPropIssue)
            or isinstance(data, github.webhooks.IssuesReopenedPropIssue)
            or isinstance(data, github.webhooks.Issue)
        ) and data.reactions:
            reactions = Reactions(
                total_count=data.reactions.total_count,
                plus_one=data.reactions.plus_one,
                minus_one=data.reactions.minus_one,
                laugh=data.reactions.laugh,
                hooray=data.reactions.hooray,
                confused=data.reactions.confused,
                heart=data.reactions.heart,
                rocket=data.reactions.rocket,
                eyes=data.reactions.eyes,
            )

        return cls(
            platform=Platforms.github,
            external_id=data.id,
            organization_id=organization_id,
            repository_id=repository_id,
            number=data.number,
            title=data.title,
            body=data.body if data.body else "",
            comments=getattr(data, "comments", None),
            author=github.jsonify(data.user),
            author_association=data.author_association,
            labels=github.jsonify(data.labels),
            assignee=github.jsonify(data.assignee),
            assignees=github.jsonify(data.assignees),
            milestone=github.jsonify(data.milestone),
            # TODO: Verify this
            closed_by=github.jsonify(github.attr(data, "closed_by")),
            reactions=jsonable_encoder(reactions),
            state=IssueModel.State(data.state),
            state_reason=github.attr(data, "state_reason"),
            issue_closed_at=data.closed_at,
            issue_created_at=data.created_at,
            issue_modified_at=data.updated_at,
        )


class IssueCreate(IssueAndPullRequestBase):
    has_pledge_badge_label: bool = False
    pledge_badge_currently_embedded: bool = False
    positive_reactions_count: int = 0
    total_engagement_count: int = 0

    @classmethod
    def from_github(
        cls,
        data: Union[
            github.rest.Issue,
            github.webhooks.Issue,
            github.webhooks.IssuesOpenedPropIssue,
            github.webhooks.IssuesClosedPropIssue,
            github.webhooks.IssuesReopenedPropIssue,
        ],
        organization_id: UUID,
        repository_id: UUID,
    ) -> Self:
        ret = super().get_normalized_github_issue(
            data,
            organization_id=organization_id,
            repository_id=repository_id,
        )

        ret.has_pledge_badge_label = IssueModel.contains_pledge_badge_label(ret.labels)

        if ret.body:
            ret.pledge_badge_currently_embedded = GithubBadge.badge_is_embedded(
                ret.body
            )

        # excluding: confused, minus_one
        ret.positive_reactions_count = (
            data.reactions.plus_one
            + data.reactions.laugh
            + data.reactions.heart
            + data.reactions.hooray
            + data.reactions.eyes
            + data.reactions.rocket
        )

        ret.total_engagement_count = data.reactions.total_count + data.comments

        return ret


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
    additions: int
    deletions: int
    state: str  # open | closed
    created_at: datetime
    merged_at: datetime | None
    closed_at: datetime | None
    is_draft: bool


class ExternalGitHubIssueCreate(Schema):
    url: str


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
    branch_name: str | None = None
    message: str | None = None


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
                if pr := m.pull_request:
                    avatar = pr.author.get("avatar_url", None) if pr.author else None
                    if not avatar:
                        raise Exception(
                            "unable to convert IssueReference to IssueReferenceRead"
                        )

                    login = pr.author.get("login", None) if pr.author else None
                    if not login:
                        raise Exception(
                            "unable to convert IssueReference to IssueReferenceRead"
                        )

                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.pull_request,
                        payload=PullRequestReference(
                            id=pr.id,
                            title=pr.title,
                            author_login=login,
                            author_avatar=avatar,
                            number=pr.number,
                            additions=pr.additions or 0,
                            deletions=pr.deletions or 0,
                            state=pr.state,
                            created_at=pr.issue_created_at,
                            merged_at=pr.merged_at,
                            closed_at=pr.issue_closed_at,
                            is_draft=bool(pr.is_draft),
                        ),
                    )

            case ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST:
                if m.external_source:
                    prx = parse_obj_as(
                        ExternalGitHubPullRequestReferenceModel, m.external_source
                    )
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_pull_request,
                        payload=ExternalGitHubPullRequestReference(
                            title=prx.title,
                            author_login=prx.user_login,
                            author_avatar=prx.user_avatar,
                            number=prx.number,
                            organization_name=prx.organization_name,
                            repository_name=prx.repository_name,
                            state=prx.state,
                        ),
                    )

            case ReferenceType.EXTERNAL_GITHUB_COMMIT:
                if m.external_source:
                    r = parse_obj_as(
                        ExternalGitHubCommitReferenceModel, m.external_source
                    )
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_commit,
                        payload=ExternalGitHubCommitReference(
                            author_login=r.user_login,
                            author_avatar=r.user_avatar,
                            organization_name=r.organization_name,
                            repository_name=r.repository_name,
                            sha=r.commit_id,
                            branch_name=r.branch_name,
                            message=r.message,
                        ),
                    )

        raise Exception("unable to convert IssueReference to IssueReferenceRead")


class IssueDependencyRead(Schema):
    dependent_issue_id: UUID
    dependency_issue_id: UUID

    class Config:
        orm_mode = True


class PostIssueComment(Schema):
    message: str
    append_badge: bool = False


class IssueUpdateBadgeMessage(Schema):
    message: str


class IssuePublicRead(Schema):
    id: UUID
    platform: Platforms
    organization_id: UUID
    repository_id: UUID
    number: int
    title: str
    # author: JSONAny
    labels: JSONAny
    # closed_by: JSONAny
    reactions: JSONAny
    state: IssueModel.State
    # state_reason: str | None
    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime
    comments: int | None
    progress: IssueStatus | None = None
    # badge_custom_content: str | None = None
    funding_goal: int | None

    class Config:
        orm_mode = True


# Internal model
class OrganizationPublicPageRead(Schema):
    organization: Organization
    repositories: list[Repository]
    issues: list[IssuePublicRead]
    total_issue_count: int
