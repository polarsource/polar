from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Self, cast
from uuid import UUID

import structlog
from fastapi.encoders import jsonable_encoder
from pydantic import ConfigDict, Field, HttpUrl

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.funding.funding_schema import Funding
from polar.integrations.github import client as github
from polar.integrations.github import types
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
from polar.models.organization import Organization as OrganizationModel
from polar.models.repository import Repository as RepositoryModel
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


class Author(Schema):
    id: int
    login: str
    html_url: HttpUrl
    avatar_url: HttpUrl


class Assignee(Schema):
    id: int
    login: str
    html_url: HttpUrl
    avatar_url: HttpUrl


# Public API
class Issue(Schema):
    id: UUID
    platform: Platforms = Field(description="Issue platform (currently always GitHub)")
    number: int = Field(description="GitHub #number")
    title: str = Field(description="GitHub issue title")
    body: str | None = Field(None, description="GitHub issue body")
    comments: int | None = Field(
        None, description="Number of GitHub comments made on the issue"
    )
    labels: list[Label] = []

    author: Author | None = Field(None, description="GitHub author")
    assignees: list[Assignee] | None = Field(None, description="GitHub assignees")
    reactions: Reactions | None = Field(None, description="GitHub reactions")

    state: Literal["OPEN", "CLOSED"]

    issue_closed_at: datetime | None = None
    issue_modified_at: datetime | None = None
    issue_created_at: datetime

    needs_confirmation_solved: bool = Field(
        description="If a maintainer needs to mark this issue as solved"
    )

    confirmed_solved_at: datetime | None = Field(
        None,
        description="If this issue has been marked as confirmed solved through Polar",
    )

    funding: Funding

    repository: Repository = Field(description="The repository that the issue is in")

    upfront_split_to_contributors: int | None = Field(
        None,
        description="Share of rewrads that will be rewarded to contributors of this issue. A number between 0 and 100 (inclusive).",  # noqa: E501
    )

    pledge_badge_currently_embedded: bool = Field(
        description="If this issue currently has the Polar badge SVG embedded"
    )

    badge_custom_content: str | None = Field(
        default=None, description="Optional custom badge SVG promotional content"
    )

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
            if i.labels and isinstance(i.labels, list)
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
            needs_confirmation_solved=i.needs_confirmation_solved,
            confirmed_solved_at=i.confirmed_solved_at,
            author=cast(Author, i.author) if i.author else None,
            assignees=cast(list[Assignee], i.assignees) if i.assignees else None,
            reactions=cast(Reactions, i.reactions) if i.reactions else None,
            funding=funding,
            repository=Repository.from_db(i.repository),
            labels=labels,
            upfront_split_to_contributors=i.upfront_split_to_contributors,
            pledge_badge_currently_embedded=i.pledge_badge_currently_embedded,
            badge_custom_content=i.badge_custom_content,
        )


class UpdateIssue(Schema):
    funding_goal: CurrencyAmount | None = None

    upfront_split_to_contributors: int | None = Field(default=None, ge=0.0, le=100.0)
    set_upfront_split_to_contributors: bool | None = None


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
    body: str | None = None
    comments: int | None = None

    author: JSONAny
    author_association: str | None = None
    labels: JSONAny
    assignee: JSONAny
    assignees: JSONAny
    milestone: JSONAny
    closed_by: JSONAny
    reactions: JSONAny

    state: IssueModel.State
    state_reason: str | None = None

    issue_closed_at: datetime | None = None
    issue_modified_at: datetime | None = None
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
        cls: type[Self],
        data: types.Issue
        | types.WebhookIssuesOpenedPropIssue
        | types.WebhookIssuesEditedPropIssue
        | types.WebhookIssuesClosedPropIssue
        | types.WebhookIssuesReopenedPropIssue
        | types.WebhookIssuesDeletedPropIssue
        | types.WebhookIssuesTransferredPropChangesPropNewIssue
        | types.PullRequest
        | types.PullRequestSimple
        | types.WebhookPullRequestOpenedPropPullRequest
        | types.WebhookPullRequestEditedPropPullRequest
        | types.WebhookPullRequestClosedPropPullRequest
        | types.WebhookPullRequestReopenedPropPullRequest
        | types.WebhookPullRequestSynchronizePropPullRequest,
        organization: OrganizationModel,
        repository: RepositoryModel,
    ) -> Self:
        """
        normalizes both issues and pull requests
        """

        if not data.id:
            raise Exception("no external id set")

        reactions: Reactions | None = None

        # All issue types have reactions, pull request types does not
        if (
            isinstance(data, types.Issue)
            or isinstance(data, types.WebhookIssuesOpenedPropIssue)
            or isinstance(data, types.WebhookIssuesEditedPropIssue)
            or isinstance(data, types.WebhookIssuesClosedPropIssue)
            or isinstance(data, types.WebhookIssuesReopenedPropIssue)
            or isinstance(data, types.WebhookIssuesDeletedPropIssue)
            or isinstance(data, types.WebhookIssuesTransferredPropChangesPropNewIssue)
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
            organization_id=organization.id,
            repository_id=repository.id,
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
    external_lookup_key: str | None = None
    has_pledge_badge_label: bool = False
    pledge_badge_embedded_at: datetime | None = None
    positive_reactions_count: int = 0
    total_engagement_count: int = 0

    @classmethod
    def from_github(
        cls,
        data: types.Issue
        | types.WebhookIssuesOpenedPropIssue
        | types.WebhookIssuesEditedPropIssue
        | types.WebhookIssuesClosedPropIssue
        | types.WebhookIssuesReopenedPropIssue
        | types.WebhookIssuesDeletedPropIssue
        | types.WebhookIssuesTransferredPropChangesPropNewIssue,
        organization: OrganizationModel,
        repository: RepositoryModel,
    ) -> Self:
        ret = super().get_normalized_github_issue(data, organization, repository)

        ret.external_lookup_key = f"{organization.name}/{repository.name}/{data.number}"

        ret.has_pledge_badge_label = IssueModel.contains_pledge_badge_label(
            ret.labels, repository.pledge_badge_label
        )

        if ret.body and GithubBadge.badge_is_embedded(ret.body):
            ret.pledge_badge_embedded_at = ret.issue_modified_at

        # this is not good, we're risking setting positive_reactions_count to 0 if the
        # payload is missing
        # TODO: only update if payload actually is set
        if data.reactions:
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
    model_config = ConfigDict(from_attributes=True)


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
    merged_at: datetime | None = None
    closed_at: datetime | None = None
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

    pull_request_reference: PullRequestReference | None = None
    external_github_pull_request_reference: (
        ExternalGitHubPullRequestReference | None
    ) = None
    external_github_commit_reference: ExternalGitHubCommitReference | None = None

    @classmethod
    def from_model(cls, m: IssueReference) -> IssueReferenceRead:
        match m.reference_type:
            case ReferenceType.PULL_REQUEST:
                if pr := m.pull_request:
                    avatar = (
                        pr.author.get("avatar_url", None)
                        if pr.author and isinstance(pr.author, dict)
                        else None
                    )
                    if not avatar:
                        raise Exception(
                            "unable to convert IssueReference to IssueReferenceRead"
                        )

                    login = (
                        pr.author.get("login", None)
                        if pr.author and isinstance(pr.author, dict)
                        else None
                    )
                    if not login:
                        raise Exception(
                            "unable to convert IssueReference to IssueReferenceRead"
                        )

                    pr_ref = PullRequestReference(
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
                    )

                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.pull_request,
                        pull_request_reference=pr_ref,
                    )

            case ReferenceType.EXTERNAL_GITHUB_PULL_REQUEST:
                if m.external_source:
                    prx = ExternalGitHubPullRequestReferenceModel.model_validate(
                        m.external_source
                    )
                    ext_pr_ref = ExternalGitHubPullRequestReference(
                        title=prx.title,
                        author_login=prx.user_login,
                        author_avatar=prx.user_avatar,
                        number=prx.number,
                        organization_name=prx.organization_name,
                        repository_name=prx.repository_name,
                        state=prx.state,
                    )
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_pull_request,
                        external_github_pull_request_reference=ext_pr_ref,
                    )

            case ReferenceType.EXTERNAL_GITHUB_COMMIT:
                if m.external_source:
                    r = ExternalGitHubCommitReferenceModel.model_validate(
                        m.external_source
                    )
                    ext_commit_ref = ExternalGitHubCommitReference(
                        author_login=r.user_login,
                        author_avatar=r.user_avatar,
                        organization_name=r.organization_name,
                        repository_name=r.repository_name,
                        sha=r.commit_id,
                        branch_name=r.branch_name,
                        message=r.message,
                    )
                    return IssueReferenceRead(
                        id=m.external_id,
                        type=IssueReferenceType.external_github_commit,
                        external_github_commit_reference=ext_commit_ref,
                    )

        raise Exception("unable to convert IssueReference to IssueReferenceRead")


class IssueDependencyRead(Schema):
    dependent_issue_id: UUID
    dependency_issue_id: UUID
    model_config = ConfigDict(from_attributes=True)


class PostIssueComment(Schema):
    message: str
    append_badge: bool = False


class IssueUpdateBadgeMessage(Schema):
    message: str
