from typing import Any

import pytest
from pydantic import ValidationError

from polar.void.reducer.derived import evaluate, merge_state, validate_inputs
from polar.void.reducer.exceptions import InvalidReducer
from polar.void.reducer.schemas import ReducerCreate


def definition(slug: str = "conversion", **overrides: Any) -> ReducerCreate:
    return ReducerCreate.model_validate(
        {
            "slug": slug,
            "aggregation": {
                "func": "derive",
                "inputs": {"opened": "opened", "sold": "sold"},
                "expression": "$sold / $opened * 100",
            },
            **overrides,
        }
    )


def test_expression_and_merge_rules() -> None:
    assert evaluate("$b / $a * 100", {"a": 100, "b": 5}) == 5
    for state in ({"a": 0, "b": 5}, {"a": None, "b": 5}):
        assert evaluate("$b / $a * 100", state) is None
    assert evaluate("$a * 1e308", {"a": 1e308}) is None
    assert evaluate("-($a + 2) / +2", {"a": 4}) == -3
    functions = {"count": "count", "sum": "sum", "min": "min", "max": "max"}
    assert merge_state(functions) == {"count": 0, "sum": 0, "min": None, "max": None}
    assert merge_state(functions, {"min": 3, "max": 4}, {"min": None, "max": 9}) == {
        "count": 0,
        "sum": 0,
        "min": 3,
        "max": 9,
    }


@pytest.mark.parametrize(
    "aggregation",
    [
        {"func": "derive", "inputs": {}, "expression": "1"},
        {"func": "derive", "inputs": {"a": "opened"}, "expression": "$b"},
        {"func": "derive", "inputs": {"a": "opened"}, "expression": "__import__('os')"},
        {"func": "derive", "inputs": {"bad-name": "opened"}, "expression": "$bad-name"},
    ],
)
def test_invalid_definitions(aggregation: dict[str, Any]) -> None:
    with pytest.raises(ValidationError):
        definition(aggregation=aggregation)


def test_source_schemas() -> None:
    with pytest.raises(ValidationError, match="filter"):
        ReducerCreate.model_validate(
            {"slug": "count", "aggregation": {"func": "count"}}
        )
    with pytest.raises(ValidationError, match="filter or map"):
        definition(map={"a": 1})


class TestValidateInputs:
    def test_event_scalar_is_accepted(self) -> None:
        source = ReducerCreate.model_validate(
            {
                "slug": "count",
                "filter": {"conjunction": "and", "clauses": []},
                "aggregation": {"func": "count"},
            }
        )
        validate_inputs({"a": "count"}, {"count": source})

    def test_missing_source_is_rejected(self) -> None:
        with pytest.raises(InvalidReducer, match="does not exist"):
            validate_inputs({"a": "missing"}, {})

    @pytest.mark.parametrize("func", ["first", "last", "derive"])
    def test_non_event_scalar_is_rejected(self, func: str) -> None:
        source = (
            definition()
            if func == "derive"
            else ReducerCreate.model_validate(
                {
                    "slug": "record",
                    "filter": {"conjunction": "and", "clauses": []},
                    "aggregation": {"func": func},
                }
            )
        )
        with pytest.raises(InvalidReducer, match="must be an event scalar"):
            validate_inputs({"a": "source"}, {"source": source})
