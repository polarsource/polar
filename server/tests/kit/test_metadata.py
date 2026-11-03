import pytest
from fastapi import Request
from pydantic import ValidationError

from polar.exceptions import PolarRequestValidationError
from polar.kit.metadata import MetadataInputMixin, _get_metadata_query


class MetadataSchema(MetadataInputMixin): ...


@pytest.mark.parametrize(
    "metadata",
    [
        pytest.param({"k" * 100: "value"}, id="too long key"),
        pytest.param({"key": "v" * 1000}, id="too long value"),
        pytest.param({f"key{i}": "value" for i in range(51)}, id="too many keys"),
    ],
)
def test_invalid_input(metadata: dict[str, str | int | bool | float]) -> None:
    with pytest.raises(ValidationError):
        MetadataSchema(metadata=metadata)


def test_serialization() -> None:
    schema = MetadataSchema(metadata={f"key{i}": "value" for i in range(50)})

    dump = schema.model_dump(by_alias=True)
    assert dump["user_metadata"] == schema.metadata


def _build_request(query_string: str) -> Request:
    return Request(
        {
            "type": "http",
            "method": "GET",
            "path": "/",
            "query_string": query_string.encode(),
            "headers": [],
        }
    )


def test_get_metadata_query() -> None:
    request = _build_request("metadata[key]=a&metadata[key]=b&metadata[other]=c")

    assert _get_metadata_query(request) == {"key": ["a", "b"], "other": ["c"]}


@pytest.mark.parametrize(
    "query_string",
    [
        pytest.param("metadata[key]=%00", id="null character in value"),
        pytest.param("metadata[ke%00y]=value", id="null character in key"),
    ],
)
def test_get_metadata_query_null_character(query_string: str) -> None:
    with pytest.raises(PolarRequestValidationError):
        _get_metadata_query(_build_request(query_string))
