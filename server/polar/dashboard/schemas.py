from datetime import datetime
from enum import Enum
from typing import Any, Generic, List, Literal, Self, TypeVar
from uuid import UUID

from pydantic import Field, parse_obj_as
from pydantic.generics import GenericModel

from polar.currency.schemas import CurrencyAmount
from polar.enums import Platforms
from polar.funding.funding_schema import Funding
from polar.funding.schemas import PledgesTypeSummaries
from polar.issue.schemas import Issue as IssueSchema
from polar.issue.schemas import IssueReferenceRead, Label, Reactions
from polar.kit.schemas import Schema
from polar.models.issue import Issue
from polar.pledge.schemas import Pledge
from polar.reward.schemas import Reward
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

    rewards: list[Reward] | None = None
    pledges_summary: PledgesTypeSummaries | None = None
    references: list[IssueReferenceRead] | None = None
    pledges: list[Pledge] | None = None


class ListResponse(GenericModel, Generic[DataT]):
    data: List[Entry[DataT]]
    included: List[Entry[Any]] = []


class SingleResponse(GenericModel, Generic[DataT]):
    data: Entry[DataT]
    included: List[Entry[Any]] = []


class PaginationResponse(Schema):
    total_count: int
    page: int
    next_page: int | None


class IssueListResponse(ListResponse[IssueSchema]):
    pagination: PaginationResponse
