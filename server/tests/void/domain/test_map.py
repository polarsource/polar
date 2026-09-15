import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from polar.void.deploy.schemas import DeployReducer
from polar.void.reducer.map import compile_expression, compile_map
from polar.void.reducer.schemas import ReducerCreate

FIXTURES = json.loads(
    (
        Path(__file__).resolve().parents[4]
        / "clients/packages/void-sdk/test/fixtures/reducer_map.json"
    ).read_text()
)
BASE = {
    "slug": "mapped",
    "filter": {"conjunction": "and", "clauses": []},
    "aggregation": {"func": "last"},
}


@pytest.mark.parametrize("expression", FIXTURES["invalid"])
def test_invalid_expressions_rejected_by_both_apis(expression: str) -> None:
    for schema in (ReducerCreate, DeployReducer):
        with pytest.raises(ValidationError):
            schema.model_validate({**BASE, "map": {"result": expression}})


@pytest.mark.parametrize("value", [float("nan"), float("inf"), float("-inf")])
def test_nonfinite_literals_are_rejected(value: float) -> None:
    with pytest.raises(ValidationError):
        ReducerCreate.model_validate({**BASE, "map": {"nested": {"number": value}}})


@pytest.mark.parametrize(
    ("expression", "expected"),
    [
        ("$value", [("ref", "value")]),
        ("($value)", [("ref", "value"), ("pos", "")]),
        ("-$value", [("ref", "value"), ("neg", "")]),
        (
            "$value + 20 * 2",
            [("ref", "value"), ("number", "20"), ("number", "2"), ("*", ""), ("+", "")],
        ),
        (
            "($value + 20) * 2",
            [("ref", "value"), ("number", "20"), ("+", ""), ("number", "2"), ("*", "")],
        ),
    ],
)
def test_expression_program(expression: str, expected: list[tuple[str, str]]) -> None:
    assert compile_expression(expression) == expected


def test_identity_empty_and_literal_maps_remain_distinct() -> None:
    assert compile_map(None) is None
    assert compile_map({}) == []
    assert compile_map({"one": 1, "flag": True, "nested": ["$value"]}) == [
        ("one", "1", []),
        ("flag", "true", []),
        ("nested", '["$value"]', []),
    ]
