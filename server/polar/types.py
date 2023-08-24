import typing as t

from pydantic.generics import GenericModel

from polar.kit.schemas import Schema

JSONDict = dict[str, t.Any]
JSONList = list[t.Any]
JSONObject = JSONDict | JSONList
JSONAny = list[dict[str, t.Any]] | dict[str, t.Any] | None


T = t.TypeVar("T")


class Pagination(Schema):
    total_count: int


class ListResource(GenericModel, t.Generic[T]):
    items: t.Sequence[T] = []
    pagination: Pagination
