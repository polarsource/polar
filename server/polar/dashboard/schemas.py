from enum import Enum
from uuid import UUID

from polar.funding.schemas import PledgesTypeSummaries
from polar.issue.schemas import Issue as IssueSchema
from polar.issue.schemas import IssueReferenceRead
from polar.kit.schemas import Schema
from polar.pledge.schemas import Pledge
from polar.reward.schemas import Reward


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
    most_recently_funded = "most_recently_funded"


class Entry(Schema):
    type: str
    id: str | UUID
    attributes: IssueSchema

    rewards: list[Reward] | None = None
    pledges_summary: PledgesTypeSummaries | None = None
    references: list[IssueReferenceRead] | None = None
    pledges: list[Pledge] | None = None


class ListResponse(Schema):
    data: list[Entry]


class PaginationResponse(Schema):
    total_count: int
    page: int
    next_page: int | None = None


class IssueListResponse(ListResponse):
    pagination: PaginationResponse
