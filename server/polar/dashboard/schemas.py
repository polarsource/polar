from datetime import datetime
from enum import Enum
from typing import Any, Generic, List, Self, TypeVar
from uuid import UUID

from pydantic import Field
from pydantic.generics import GenericModel

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.funding.schemas import Funding
from polar.kit.schemas import Schema
from polar.models.issue import Issue
from polar.types import JSONAny


class IssueListType(str, Enum):
    issues = "issues"
    dependencies = "dependencies"


class IssueStatus(str, Enum):
    backlog = "backlog"
    triaged = "triaged"
    in_progress = "in_progress"
    pull_request = "pull_request"
    closed = "closed"

    # deprecated
    building = "building"


# Public API
class IssueSortBy(str, Enum):
    newest = "newest"
    recently_updated = "recently_updated"
    least_recently_updated = "least_recently_updated"
    pledged_amount_desc = "pledged_amount_desc"
    relevance = "relevance"  # best search match
    dependencies_default = (
        "dependencies_default"  # (state, self pledged amount, updated at)
    )
    issues_default = "issues_default"  # (total pledged amount, thumbs up, updated at)
    most_engagement = "most_engagement"
    most_positive_reactions = "most_positive_reactions"
    funding_goal_desc_and_most_positive_reactions = (
        "funding_goal_desc_and_most_positive_reactions"
    )


# JSON:API types below
# TODO: Move this to a separate package if we use it elsewhere

DataT = TypeVar("DataT")


class RelationshipData(Schema):
    type: str
    id: str | UUID


class Relationship(Schema):
    # TODO: links?
    data: RelationshipData | List[RelationshipData]


IssueRelationship = dict[str, Relationship]


class Entry(GenericModel, Generic[DataT]):
    type: str
    id: str | UUID
    attributes: DataT
    relationships: IssueRelationship | None = None


class ListResponse(GenericModel, Generic[DataT]):
    data: List[Entry[DataT]]
    included: List[Entry[Any]] = []


class SingleResponse(GenericModel, Generic[DataT]):
    data: Entry[DataT]
    included: List[Entry[Any]] = []


class IssueDashboardRead(Schema):
    id: UUID
    platform: Platforms
    organization_id: UUID
    repository_id: UUID
    number: int
    title: str
    author: JSONAny
    labels: JSONAny
    closed_by: JSONAny
    reactions: JSONAny
    state: Issue.State
    state_reason: str | None
    issue_closed_at: datetime | None
    issue_modified_at: datetime | None
    issue_created_at: datetime
    comments: int | None
    progress: IssueStatus | None = None
    badge_custom_content: str | None = None
    funding: Funding
    pledge_badge_currently_embedded: bool

    needs_confirmation_solved: bool = Field(
        description="If a maintainer needs to mark this issue as solved"
    )

    confirmed_solved_at: datetime | None = Field(
        description="If this issue has been marked as confirmed solved through Polar"
    )

    @classmethod
    def from_db(cls, i: Issue) -> Self:
        funding = Funding(
            funding_goal=CurrencyAmount(currency="USD", amount=i.funding_goal)
            if i.funding_goal
            else None,
            pledges_sum=CurrencyAmount(currency="USD", amount=i.pledged_amount_sum),
        )

        return cls(
            id=i.id,
            platform=i.platform,
            organization_id=i.organization_id,
            repository_id=i.repository_id,
            number=i.number,
            title=i.title,
            author=i.author,
            labels=i.labels,
            closed_by=i.closed_by,
            reactions=i.reactions,
            state=Issue.State.OPEN
            if i.state == "OPEN" or i.state == "open"
            else Issue.State.CLOSED,
            state_reason=i.state_reason,
            issue_closed_at=i.issue_closed_at,
            issue_modified_at=i.issue_modified_at,
            issue_created_at=i.issue_created_at,
            comments=i.comments,
            progress=issue_progress(i),
            badge_custom_content=i.badge_custom_content,
            funding=funding,
            pledge_badge_currently_embedded=i.pledge_badge_currently_embedded,
            needs_confirmation_solved=i.needs_confirmation_solved,
            confirmed_solved_at=i.confirmed_solved_at,
        )


def issue_progress(issue: Issue) -> IssueStatus:
    # closed
    if issue.issue_closed_at:
        return IssueStatus.closed

    # pull_request
    for r in issue.references:
        if r.pull_request and not r.pull_request.is_draft:
            return IssueStatus.pull_request

    # building
    for r in issue.references:
        if r.pull_request and r.pull_request.is_draft:
            return IssueStatus.in_progress
    if issue.references:
        return IssueStatus.in_progress

    # triaged
    if issue.assignee or issue.assignees:
        return IssueStatus.triaged

    # backlog
    return IssueStatus.backlog


class PaginationResponse(Schema):
    total_count: int
    page: int
    next_page: int | None


class IssueListResponse(ListResponse[IssueDashboardRead]):
    pagination: PaginationResponse
