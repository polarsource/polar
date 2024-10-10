from __future__ import annotations

from datetime import datetime
from typing import Annotated, Any, Self
from uuid import UUID

from pydantic import BeforeValidator, ConfigDict, Field, HttpUrl

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.funding.funding_schema import Funding
from polar.integrations.github import client as github
from polar.integrations.github import types
from polar.integrations.github.badge import GithubBadge
from polar.kit.schemas import Schema
from polar.models.external_organization import (
    ExternalOrganization as ExternalOrganizationModel,
)
from polar.models.issue import Issue as IssueModel
from polar.models.repository import Repository as RepositoryModel
from polar.repository.schemas import Repository
from polar.types import JSONAny


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
def labels_validator(labels: Any | None) -> list[Label]:
    if labels is None:
        return []

    return [
        Label(name=label["name"], color=label["color"])
        for label in labels
        if "name" in label and "color" in label
    ]


Labels = Annotated[list[Label], BeforeValidator(labels_validator)]


class Issue(Schema):
    id: UUID
    platform: Platforms = Field(description="Issue platform (currently always GitHub)")
    number: int = Field(description="GitHub #number")
    title: str = Field(description="GitHub issue title")
    body: str | None = Field(None, description="GitHub issue body")
    comments: int | None = Field(
        None, description="Number of GitHub comments made on the issue"
    )
    labels: Labels = []

    author: Author | None = Field(None, description="GitHub author")
    assignees: list[Assignee] | None = Field(None, description="GitHub assignees")
    reactions: Reactions | None = Field(None, description="GitHub reactions")

    state: IssueModel.State

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
        | types.PullRequestWebhook,
        organization: ExternalOrganizationModel,
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

        closed_by: github.Missing[types.SimpleUser | None] = getattr(
            data, "closed_by", None
        )
        state_reason: github.Missing[str | None] = getattr(data, "state_reason", None)

        labels: list[Any] | None = None
        if data.labels:
            labels = []
            for label in data.labels:
                if label is None:
                    continue
                if isinstance(label, str):
                    labels.append(label)
                else:
                    labels.append(label.model_dump(mode="json"))

        return cls(
            platform=Platforms.github,
            external_id=data.id,
            organization_id=organization.id,
            repository_id=repository.id,
            number=data.number,
            title=data.title,
            body=data.body if data.body else "",
            comments=getattr(data, "comments", None),
            author=data.user.model_dump(mode="json") if data.user else None,
            author_association=data.author_association,
            labels=labels,
            assignee=data.assignee.model_dump(mode="json") if data.assignee else None,
            assignees=[
                assignee.model_dump(mode="json")
                for assignee in data.assignees
                if assignee
            ]
            if data.assignees
            else None,
            milestone=data.milestone.model_dump(mode="json")
            if data.milestone
            else None,
            closed_by=closed_by.model_dump(mode="json") if closed_by else None,
            reactions=reactions.model_dump(mode="json") if reactions else None,
            state=IssueModel.State(data.state),
            state_reason=state_reason if state_reason else None,
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
        organization: ExternalOrganizationModel,
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


class IssueUpdate(IssueCreate): ...


class IssueRead(IssueCreate):
    id: UUID
    created_at: datetime
    modified_at: datetime | None
    model_config = ConfigDict(from_attributes=True)


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


class PostIssueComment(Schema):
    message: str
    append_badge: bool = False


class IssueUpdateBadgeMessage(Schema):
    message: str
