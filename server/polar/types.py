import typing as t

JSONDict = dict[str, t.Any]
JSONList = list[t.Any]
JSONObject = JSONDict | JSONList
JSONAny = JSONList | JSONDict | None
