from typing import Any, Generic, List, TypeVar, Union
from uuid import UUID
from polar.issue.schemas import IssueRead
from polar.kit.schemas import Schema
from pydantic.generics import GenericModel
from enum import Enum


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
    pledged_amount_desc = "pledged_amount_desc"
    relevance = "relevance"  # best search match
    dependencies_default = (
        "dependencies_default"  # (state, self pledged amount, updated at)
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


class IssueListResponse(ListResponse[IssueRead]):
    ...
