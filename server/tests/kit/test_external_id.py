import pytest
from pydantic import ValidationError

from polar.kit.external_id import ExternalIDInputMixin


@pytest.mark.parametrize(
    ("value", "expected"),
    [
        ("pro", "pro"),
        ("Pro_Monthly-2", "Pro_Monthly-2"),
        ("confirmix.plan.free", "confirmix.plan.free"),
        ("4513d60b:month", "4513d60b:month"),
        ("  pro  ", "pro"),
        ("", None),
        ("   ", None),
        (None, None),
    ],
)
def test_valid(value: str | None, expected: str | None) -> None:
    assert ExternalIDInputMixin(external_id=value).external_id == expected


@pytest.mark.parametrize(
    "value",
    ["pro plan", "pro/plan", "pro?x", "pro#x", "_pro", ".", "..", "-pro", "pró"],
)
def test_invalid(value: str) -> None:
    with pytest.raises(ValidationError):
        ExternalIDInputMixin(external_id=value)
