import typing as t

JSONDict = dict[str, t.Any]
JSONList = list[t.Any]
JSONObject = JSONDict | JSONList
JSONAny = list[dict[str, t.Any]] | dict[str, t.Any] | None
