from datetime import UTC, datetime
from typing import Any

from polar.meter.event import BufferedEvent
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator

EVENT_EPOCH = int(datetime(2026, 6, 9, 10, 0, tzinfo=UTC).timestamp())


def _event(**body: Any) -> BufferedEvent:
    body.setdefault("name", "ai_usage")
    body.setdefault("timestamp", "2026-06-09T10:00:00+00:00")
    return BufferedEvent.from_body(body)


def test_name_eq_and_ne() -> None:
    clause = FilterClause(property="name", operator=FilterOperator.eq, value="ai_usage")
    assert clause.matches(_event(name="ai_usage")) is True
    assert clause.matches(_event(name="other")) is False

    clause = FilterClause(property="name", operator=FilterOperator.ne, value="ai_usage")
    assert clause.matches(_event(name="other")) is True


def test_like_and_not_like_substring() -> None:
    like = FilterClause(property="name", operator=FilterOperator.like, value="usage")
    assert like.matches(_event(name="ai_usage")) is True
    assert like.matches(_event(name="signup")) is False

    not_like = FilterClause(
        property="name", operator=FilterOperator.not_like, value="usage"
    )
    assert not_like.matches(_event(name="signup")) is True
    assert not_like.matches(_event(name="ai_usage")) is False


def test_source_defaults_to_user() -> None:
    clause = FilterClause(property="source", operator=FilterOperator.eq, value="user")
    assert clause.matches(_event()) is True


def test_timestamp_requires_int_value() -> None:
    gt = FilterClause(
        property="timestamp", operator=FilterOperator.gt, value=EVENT_EPOCH - 1
    )
    assert gt.matches(_event()) is True

    lt = FilterClause(
        property="timestamp", operator=FilterOperator.gt, value=EVENT_EPOCH + 1
    )
    assert lt.matches(_event()) is False

    string_value = FilterClause(
        property="timestamp", operator=FilterOperator.gt, value="nope"
    )
    assert string_value.matches(_event()) is False


def test_metadata_numeric_comparison() -> None:
    clause = FilterClause(
        property="metadata.tokens", operator=FilterOperator.gt, value=5
    )
    assert clause.property == "tokens"  # prefix stripped, mirroring upstream
    assert clause.matches(_event(metadata={"tokens": 10})) is True
    assert clause.matches(_event(metadata={"tokens": 1})) is False


def test_metadata_missing_returns_false() -> None:
    clause = FilterClause(property="tokens", operator=FilterOperator.eq, value=5)
    assert clause.matches(_event()) is False


def test_metadata_type_mismatch_returns_false() -> None:
    clause = FilterClause(property="tokens", operator=FilterOperator.gt, value=5)
    assert clause.matches(_event(metadata={"tokens": "lots"})) is False


def test_filter_and_conjunction() -> None:
    filter = Filter(
        conjunction=FilterConjunction.and_,
        clauses=[
            FilterClause(property="name", operator=FilterOperator.eq, value="ai_usage"),
            FilterClause(property="tokens", operator=FilterOperator.gte, value=10),
        ],
    )
    assert filter.matches(_event(name="ai_usage", metadata={"tokens": 10})) is True
    assert filter.matches(_event(name="ai_usage", metadata={"tokens": 1})) is False


def test_filter_or_conjunction_and_nesting() -> None:
    filter = Filter(
        conjunction=FilterConjunction.or_,
        clauses=[
            FilterClause(property="name", operator=FilterOperator.eq, value="a"),
            Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="name", operator=FilterOperator.eq, value="b"
                    ),
                    FilterClause(
                        property="tokens", operator=FilterOperator.eq, value=1
                    ),
                ],
            ),
        ],
    )
    assert filter.matches(_event(name="a")) is True
    assert filter.matches(_event(name="b", metadata={"tokens": 1})) is True
    assert filter.matches(_event(name="b", metadata={"tokens": 2})) is False


def test_empty_clauses_match() -> None:
    filter = Filter(conjunction=FilterConjunction.and_, clauses=[])
    assert filter.matches(_event()) is True


def test_filter_parses_from_dict() -> None:
    filter = Filter.model_validate(
        {
            "conjunction": "and",
            "clauses": [{"property": "name", "operator": "eq", "value": "ai_usage"}],
        }
    )
    assert filter.matches(_event(name="ai_usage")) is True
