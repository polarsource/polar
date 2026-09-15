import pytest
from pydantic import ValidationError

from polar.void.reducer.filter import (
    Filter,
    FilterClause,
    FilterConjunction,
    FilterOperator,
    to_dnf,
)


def clause(value: str) -> FilterClause:
    return FilterClause(
        property="metadata.kind", operator=FilterOperator.eq, value=value
    )


def test_nested_conjunction_is_distributed_without_changing_order() -> None:
    first, second, third = clause("first"), clause("second"), clause("third")
    nested = Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            first,
            Filter(conjunction=FilterConjunction.or_, clauses=[second, third]),
        ],
    )
    assert first.property == "kind"
    assert to_dnf(nested) == [[first, second], [first, third]]


@pytest.mark.parametrize(
    ("conjunction", "expected"),
    [(FilterConjunction.and_, [[]]), (FilterConjunction.or_, [])],
)
def test_empty_filter(
    conjunction: FilterConjunction, expected: list[list[FilterClause]]
) -> None:
    assert to_dnf(Filter(conjunction=conjunction, clauses=[])) == expected


@pytest.mark.parametrize("value", [2147483648, -2147483649, "x" * 1001])
def test_invalid_filter_values(value: int | str) -> None:
    with pytest.raises(ValidationError):
        FilterClause(property="amount", operator=FilterOperator.eq, value=value)
