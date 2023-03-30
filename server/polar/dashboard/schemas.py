from typing import Any, Generic, List, TypeVar, Union
from uuid import UUID
from polar.issue.schemas import IssueRead
from polar.kit.schemas import Schema
from pydantic.generics import GenericModel
from enum import Enum


class IssueStatus(str, Enum):
    backlog = "backlog"
    building = "building"
    pull_request = "pull_request"
    completed = "completed"


# JSON:API types below
# TODO: Move this to a separate package if we use it elsewhere

DataT = TypeVar("DataT")


class RelationshipData(Schema):
    type: str
    id: str | UUID


class Relationship(Schema):
    # TODO: links?
    data: RelationshipData | List[RelationshipData]


class IssueRelationship(Schema):
    pledges: List[Relationship] | None = None
    organization: Relationship | None = None
    repository: Relationship | None = None
    references: List[Relationship] | None = None
    dependencies: List[Relationship] | None = None


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
