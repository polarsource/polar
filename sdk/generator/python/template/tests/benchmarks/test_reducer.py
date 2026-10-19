import datetime
import random
import typing

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.outpost.event import Event
from polar.outpost.reducer import (
    Aggregation,
    Filter,
    FilterClause,
    Reducer,
    get_bucket_start,
    get_matcher,
    reduce,
)

pytestmark = pytest.mark.benchmark

EVENTS = 1_000
CUSTOMERS = 10
NAMES = ["llm.call", "tool.call", "agent.run", "embedding"]
MODELS = ["claude-sonnet-5", "gpt-5", "gemini-3-pro"]
START = datetime.datetime(2026, 10, 1, 12, 0, 0, tzinfo=datetime.UTC)
Operator = typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"]
OPERATORS: list[Operator] = ["eq", "ne", "gt", "gte", "lt", "lte"]
AGGREGATIONS: list[Aggregation] = [
    {"func": "count"},
    {"func": "sum", "property": "metadata.tokens"},
    {"func": "min", "property": "metadata.tokens"},
    {"func": "max", "property": "metadata.tokens"},
    {"func": "avg", "property": "metadata.tokens"},
]


def make_events(count: int) -> list[Event]:
    # The same events on every run, so the numbers compare across commits.
    generator = random.Random(4242)
    return [
        Event(
            name=generator.choice(NAMES),
            external_customer_id=f"kr-{1 + generator.randrange(CUSTOMERS):03d}",
            timestamp=START + datetime.timedelta(seconds=index),
            metadata={
                "tokens": generator.randrange(12_000),
                "model": generator.choice(MODELS),
                "_llm": {
                    "input_tokens": generator.randrange(8_000),
                    "vendor": "anthropic",
                },
            },
        )
        for index in range(count)
    ]


events = make_events(EVENTS)
oldest_bucket_start = get_bucket_start(START)


def clause(property: str, operator: Operator, value: str | int) -> FilterClause:
    return {"property": property, "operator": operator, "value": value}


def all_of(*clauses: Filter | FilterClause) -> Filter:
    return {"conjunction": "and", "clauses": list(clauses)}


def any_of(*clauses: Filter | FilterClause) -> Filter:
    return {"conjunction": "or", "clauses": list(clauses)}


def reducer_of(id: str, filter: Filter, aggregation: Aggregation) -> Reducer:
    return {"id": id, "filter": filter, "aggregation": aggregation}


def match_all(filter: Filter) -> None:
    matches = get_matcher(filter)
    for event in events:
        matches(event)


def reduce_all(reducers: list[Reducer], batch: list[Event]) -> None:
    reduce(
        [(reducer, get_matcher(reducer["filter"])) for reducer in reducers],
        batch,
        oldest_bucket_start=oldest_bucket_start,
    )


@pytest.mark.parametrize("operator", OPERATORS)
def test_matcher_on_a_metadata_number(
    benchmark: BenchmarkFixture, operator: Operator
) -> None:
    benchmark(match_all, all_of(clause("metadata.tokens", operator, 6_000)))


def test_matcher_eq_on_the_event_name(benchmark: BenchmarkFixture) -> None:
    benchmark(match_all, all_of(clause("name", "eq", "llm.call")))


def test_matcher_eq_on_a_nested_metadata_string(benchmark: BenchmarkFixture) -> None:
    benchmark(match_all, all_of(clause("metadata._llm.vendor", "eq", "anthropic")))


def test_matcher_and_of_three_clauses(benchmark: BenchmarkFixture) -> None:
    benchmark(
        match_all,
        all_of(
            clause("name", "eq", "llm.call"),
            clause("metadata.tokens", "gt", 1_000),
            clause("metadata.model", "ne", "gpt-5"),
        ),
    )


def test_matcher_or_of_three_clauses(benchmark: BenchmarkFixture) -> None:
    benchmark(
        match_all,
        any_of(
            clause("name", "eq", "embedding"),
            clause("metadata.tokens", "gt", 11_000),
            clause("metadata.model", "eq", "gemini-3-pro"),
        ),
    )


def test_matcher_and_of_an_or_and_a_clause(benchmark: BenchmarkFixture) -> None:
    benchmark(
        match_all,
        all_of(
            any_of(clause("name", "eq", "llm.call"), clause("name", "eq", "embedding")),
            clause("metadata.tokens", "gte", 500),
        ),
    )


@pytest.mark.parametrize("aggregation", AGGREGATIONS, ids=lambda a: a["func"])
def test_reduce_one_reducer_1000_events(
    benchmark: BenchmarkFixture, aggregation: Aggregation
) -> None:
    reducers = [
        reducer_of("tokens", all_of(clause("name", "eq", "llm.call")), aggregation)
    ]
    benchmark(reduce_all, reducers, events)


ten_reducers = [
    reducer_of(
        f"reducer-{index}",
        all_of(
            clause("name", "eq", NAMES[index % len(NAMES)]),
            clause("metadata.tokens", "gte", index * 1_000),
        ),
        {"func": "sum", "property": "metadata.tokens"},
    )
    for index in range(10)
]


def test_reduce_sum_ten_reducers_1000_events(benchmark: BenchmarkFixture) -> None:
    benchmark(reduce_all, ten_reducers, events)


def test_reduce_sum_one_reducer_one_matching_event(benchmark: BenchmarkFixture) -> None:
    llm_call = next(event for event in events if event.name == "llm.call")
    benchmark(reduce_all, [ten_reducers[0]], [llm_call])
