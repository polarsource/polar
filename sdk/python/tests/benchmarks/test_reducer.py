import collections.abc
import datetime
import typing

import pytest
from pytest_codspeed import BenchmarkFixture

from polar.outpost.event import Event
from polar.outpost.reducer import (
    Aggregation,
    Filter,
    FilterClause,
    Reducer,
    ReducerMatcher,
    get_bucket_start,
    get_matcher,
    reduce,
    with_matchers,
)
from tests.benchmarks import DATA

pytestmark = pytest.mark.benchmark

EVENTS: dict[str, typing.Any] = DATA["events"]
CUSTOMERS: int = EVENTS["customers"]
NAMES: list[str] = EVENTS["names"]
MODELS: list[str] = EVENTS["models"]
# Events start at the cold boundary, one per second.
START = datetime.datetime.fromtimestamp(DATA["cold_until"] / 1_000_000, tz=datetime.UTC)
Operator = typing.Literal["eq", "ne", "gt", "gte", "lt", "lte"]
OPERATORS: list[Operator] = ["eq", "ne", "gt", "gte", "lt", "lte"]
AGGREGATIONS: list[Aggregation] = [
    {"func": "count"},
    {"func": "sum", "property": "metadata.tokens"},
    {"func": "min", "property": "metadata.tokens"},
    {"func": "max", "property": "metadata.tokens"},
    {"func": "avg", "property": "metadata.tokens"},
]


def seeded(seed: int) -> collections.abc.Callable[[], float]:
    # Mulberry32: the same events in every SDK, so the numbers compare across commits.
    state = seed & 0xFFFFFFFF

    def random() -> float:
        nonlocal state
        state = (state + 0x6D2B79F5) & 0xFFFFFFFF
        t = state
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return random


def make_events(count: int) -> list[Event]:
    random = seeded(EVENTS["seed"])
    return [
        Event(
            name=NAMES[int(random() * len(NAMES))],
            external_customer_id=f"kr-{1 + int(random() * CUSTOMERS):03d}",
            timestamp=START + datetime.timedelta(seconds=index),
            metadata={
                "tokens": int(random() * 12_000),
                "model": MODELS[int(random() * len(MODELS))],
                "_llm": {
                    "input_tokens": int(random() * 8_000),
                    "vendor": "anthropic",
                },
            },
        )
        for index in range(count)
    ]


events = make_events(EVENTS["count"])
oldest_bucket_start = get_bucket_start(START)


def clause(property: str, operator: Operator, value: str | int) -> FilterClause:
    return {"property": property, "operator": operator, "value": value}


def all_of(*clauses: Filter | FilterClause) -> Filter:
    return {"conjunction": "and", "clauses": list(clauses)}


def any_of(*clauses: Filter | FilterClause) -> Filter:
    return {"conjunction": "or", "clauses": list(clauses)}


def reducer_of(id: str, filter: Filter, aggregation: Aggregation) -> Reducer:
    return {"id": id, "kind": "usage", "filter": filter, "aggregation": aggregation}


def match_all(filter: Filter) -> None:
    matches = get_matcher(filter)
    for event in events:
        matches(event)


def reduce_all(matchers: list[ReducerMatcher], batch: list[Event]) -> None:
    reduce(matchers, batch, oldest_bucket_start=oldest_bucket_start)


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
    benchmark(reduce_all, with_matchers(reducers), events)


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
    benchmark(reduce_all, with_matchers(ten_reducers), events)


def test_reduce_sum_one_reducer_one_matching_event(benchmark: BenchmarkFixture) -> None:
    llm_call = next(event for event in events if event.name == "llm.call")
    benchmark(reduce_all, with_matchers([ten_reducers[0]]), [llm_call])
