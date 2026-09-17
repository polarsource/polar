from typing import Any

from polar.void.reducer.filter import EventMatcher, FilterTypeAdapter


def matcher(clauses: list[dict[str, Any]], conjunction: str = "and") -> EventMatcher:
    return EventMatcher(
        FilterTypeAdapter.validate_python(
            {"conjunction": conjunction, "clauses": clauses}
        )
    )


class TestEventMatcher:
    def test_name_and_metadata_clauses(self) -> None:
        match = matcher(
            [
                {"property": "name", "operator": "eq", "value": "llm.completion"},
                {
                    "property": "metadata.model",
                    "operator": "like",
                    "value": "ANTHROPIC/",
                },
                {"property": "output_tokens", "operator": "gte", "value": 4},
            ]
        )
        assert match.matches(
            "llm.completion", {"model": "anthropic/claude", "output_tokens": 4}
        )
        assert not match.matches(
            "llm.completion", {"model": "openai/gpt", "output_tokens": 4}
        )
        assert not match.matches(
            "llm.completion", {"model": "anthropic/claude", "output_tokens": 3}
        )
        assert not match.matches(
            "llm.completion", {"model": "anthropic/claude", "output_tokens": "many"}
        )
        assert not match.matches("tool.call", {"model": "anthropic/claude"})

    def test_strings_compare_exactly_and_booleans_as_lowercase(self) -> None:
        assert matcher([{"property": "kind", "operator": "eq", "value": "X"}]).matches(
            "e", {"kind": "X"}
        )
        assert not matcher(
            [{"property": "kind", "operator": "eq", "value": "X"}]
        ).matches("e", {"kind": "x"})
        assert matcher([{"property": "ok", "operator": "eq", "value": True}]).matches(
            "e", {"ok": True}
        )

    def test_missing_metadata_only_matches_negations(self) -> None:
        assert matcher([{"property": "kind", "operator": "ne", "value": "x"}]).matches(
            "e", {}
        )
        assert not matcher(
            [{"property": "kind", "operator": "eq", "value": "x"}]
        ).matches("e", {})

    def test_empty_filter_matches_everything(self) -> None:
        assert EventMatcher(None).matches("e", {})
        assert matcher([]).matches("e", {})
        assert matcher([]).event_names is None

    def test_event_names_need_a_pin_in_every_group(self) -> None:
        pinned = matcher(
            [
                {"property": "name", "operator": "eq", "value": "a"},
                {"property": "name", "operator": "eq", "value": "b"},
            ],
            conjunction="or",
        )
        assert pinned.event_names == ["a", "b"]
        loose = matcher(
            [
                {"property": "name", "operator": "eq", "value": "a"},
                {"property": "kind", "operator": "eq", "value": "x"},
            ],
            conjunction="or",
        )
        assert loose.event_names is None
