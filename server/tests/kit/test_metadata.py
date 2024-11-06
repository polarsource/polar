import pytest
from pydantic import ValidationError

from polar.kit.metadata import MetadataInputMixin


class MetadataSchema(MetadataInputMixin): ...


@pytest.mark.parametrize(
    "metadata",
    [
        pytest.param({"k" * 100: "value"}, id="too long key"),
        pytest.param({"key": "v" * 1000}, id="too long value"),
        pytest.param({f"key{i}": "value" for i in range(51)}, id="too many keys"),
    ],
)
def test_invalid_input(metadata: dict[str, str | int | bool]) -> None:
    with pytest.raises(ValidationError):
        MetadataSchema(metadata=metadata)


def test_serialization() -> None:
    schema = MetadataSchema(metadata={f"key{i}": "value" for i in range(50)})

    dump = schema.model_dump(by_alias=True)
    assert dump["user_metadata"] == schema.metadata
