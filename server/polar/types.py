import typing as t

from pydantic.generics import GenericModel

JSONDict = dict[str, t.Any]
JSONList = list[t.Any]
JSONObject = JSONDict | JSONList
JSONAny = list[dict[str, t.Any]] | dict[str, t.Any] | None


T = t.TypeVar("T")


class ListResource(GenericModel, t.Generic[T]):
    items: t.Sequence[T] = []
