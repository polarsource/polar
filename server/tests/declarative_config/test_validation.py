from typing import Any

import pytest

from polar.declarative_config import validation
from polar.exceptions import PolarRequestValidationError
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_event_type

TOOL_CALLS: dict[str, Any] = {
    "external_id": "tool-calls",
    "name": "SDK - Tool Calls",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": "tool_call"}],
    },
    "aggregation": {"func": "count"},
    "unit": "custom",
    "custom_label": "call",
}


@pytest.mark.asyncio
class TestValidate:
    async def test_valid(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await create_event_type(
            save_fixture, organization=organization, name="tool_call"
        )

        validated = await validation.validate(
            session, organization, {"meters": [TOOL_CALLS]}
        )

        assert validated.is_valid
        assert validated.issues == []
        assert [meter.external_id for meter in validated.meters] == ["tool-calls"]
        validated.raise_for_errors()

    async def test_not_an_object(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(session, organization, [])

        assert [(issue.code, issue.path) for issue in validated.issues] == [
            ("dict_type", [])
        ]

    async def test_section_must_be_a_list(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(session, organization, {"meters": "nope"})

        assert [(issue.code, issue.path) for issue in validated.issues] == [
            ("list_type", ["meters"])
        ]

    async def test_null_section(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(session, organization, {"meters": None})

        assert [(issue.code, issue.path) for issue in validated.issues] == [
            ("list_type", ["meters"])
        ]

    async def test_too_many_meters(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meters": [TOOL_CALLS] * 101}
        )

        assert [(issue.code, issue.path, issue.got) for issue in validated.errors] == [
            ("too_long", ["meters"], 101)
        ]

    async def test_unknown_section(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meter": [TOOL_CALLS]}
        )

        assert [(issue.code, issue.path) for issue in validated.errors] == [
            ("unknown_section", ["meter"])
        ]

    async def test_reports_every_problem_of_a_meter(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        broken = {
            **TOOL_CALLS,
            "external_id": "",
            "name": "x",
            "aggregation": {"func": "sum"},
        }

        validated = await validation.validate(
            session, organization, {"meters": [broken]}
        )

        assert [issue.path for issue in validated.errors] == [
            ["meters", 0, "name"],
            ["meters", 0, "aggregation", "sum", "property"],
            ["meters", 0, "external_id"],
        ]
        assert validated.errors[0].got == "x"
        assert validated.meters == []

    async def test_raise_for_errors(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meters": [{**TOOL_CALLS, "unit": "bogus"}]}
        )

        with pytest.raises(PolarRequestValidationError) as excinfo:
            validated.raise_for_errors()
        assert excinfo.value.errors()[0]["loc"] == ("body", "meters", 0, "unit")

    async def test_warnings_do_not_block(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meters": [TOOL_CALLS]}
        )

        assert [issue.severity for issue in validated.issues] == ["warning"]
        assert validated.is_valid
        validated.raise_for_errors()

    async def test_duplicate_external_id(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meters": [TOOL_CALLS, TOOL_CALLS]}
        )

        assert [issue.code for issue in validated.errors] == ["duplicate_external_id"]
        assert validated.errors[0].path == ["meters", 1, "external_id"]

    async def test_unknown_event_is_a_warning_even_on_a_broken_meter(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        validated = await validation.validate(
            session, organization, {"meters": [{**TOOL_CALLS, "unit": "bogus"}]}
        )

        warnings = [i for i in validated.issues if i.severity == "warning"]
        assert [issue.code for issue in warnings] == ["unknown_event"]
        assert warnings[0].path == ["meters", 0, "filter", "clauses", 0, "value"]
        assert warnings[0].got == "tool_call"
        assert not validated.is_valid

    async def test_nested_filters(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        nested = {
            **TOOL_CALLS,
            "filter": {
                "conjunction": "or",
                "clauses": [
                    TOOL_CALLS["filter"],
                    {
                        "conjunction": "and",
                        "clauses": [
                            {"property": "name", "operator": "eq", "value": "embed"}
                        ],
                    },
                ],
            },
        }

        validated = await validation.validate(
            session, organization, {"meters": [nested]}
        )

        assert [issue.got for issue in validated.issues] == ["tool_call", "embed"]
