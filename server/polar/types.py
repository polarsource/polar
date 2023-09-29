import typing as t

from polar.kit.schemas import Schema

JSONDict = dict[str, t.Any]
JSONList = list[t.Any]
JSONObject = JSONDict | JSONList
JSONAny = JSONList | JSONDict | None


T = t.TypeVar("T")


class Pagination(Schema):
    total_count: int


class ListResource(Schema, t.Generic[T]):
    items: t.Sequence[T] = []
    pagination: Pagination
