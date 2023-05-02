from datetime import datetime
from typing import Any, Generic, List, TypeVar
from uuid import UUID
from polar.enums import Platforms
from polar.models.issue import Issue
from polar.kit.schemas import Schema
from pydantic.generics import GenericModel
from enum import Enum
from polar.types import JSONAny


class IssueListType(str, Enum):
    issues = "issues"
    dependencies = "dependencies"


class IssueStatus(str, Enum):
    backlog = "backlog"
    building = "building"
    pull_request = "pull_request"
    completed = "completed"


class IssueSortBy(str, Enum):
    newest = "newest"
    recently_updated = "recently_updated"
    pledged_amount_desc = "pledged_amount_desc"
    relevance = "relevance"  # best search match
    dependencies_default = (
        "dependencies_default"  # (state, self pledged amount, updated at)
    )
    issues_default = "issues_default"  # (total pledged amount, thumbs up, updated at)


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

    class Config:
        orm_mode = True


class PaginationResponse(Schema):
    total_count: int
    page: int
    next_page: int | None


class IssueListResponse(ListResponse[IssueDashboardRead]):
    pagination: PaginationResponse
