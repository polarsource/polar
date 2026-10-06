from typing import Any

import pytest

from polar.declarative_config import validation
from polar.declarative_config.schemas import Config, ConfigIssueSeverity
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_event,
    create_event_type,
    create_meter,
)

METER: dict[str, Any] = {
    "external_id": "my-meter",
    "name": "My Meter",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": METER_TEST_EVENT}],
    },
    "aggregation": {"func": "count"},
}


@pytest.mark.asyncio
class TestCheck:
    async def test_new_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        await create_event_type(
            save_fixture, organization=organization, name=METER_TEST_EVENT
        )

        result = await validation.check(
            session,
            organization,
            Config.model_validate({"meters": [METER]}),
            for_update=False,
        )

        assert result.issues == []
        [change] = result.meter_changes
        assert change.meter is None
        assert change.update_dict == {}

    async def test_existing_meter_diff(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )

        result = await validation.check(
            session,
            organization,
            Config.model_validate({"meters": [{**METER, "name": "Renamed"}]}),
            for_update=False,
        )

        [change] = result.meter_changes
        assert change.meter == meter
        assert change.update_dict == {"name": "Renamed"}

    async def test_locked_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )
        await create_event_type(
            save_fixture, organization=organization, name=METER_TEST_EVENT
        )

        result = await validation.check(
            session,
            organization,
            Config.model_validate(
                {
                    "meters": [
                        {**METER, "aggregation": {"func": "sum", "property": "tokens"}}
                    ]
                }
            ),
            for_update=False,
        )

        [error] = result.errors
        assert error.type == "meter_locked"
        assert error.loc == ["body", "meters", 0, "aggregation"]

    async def test_locked_meter_allows_other_fields(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        result = await validation.check(
            session,
            organization,
            Config.model_validate({"meters": [{**METER, "name": "Renamed"}]}),
            for_update=False,
        )

        assert result.errors == []

    async def test_unknown_event_is_a_warning(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        result = await validation.check(
            session,
            organization,
            Config.model_validate({"meters": [METER]}),
            for_update=False,
        )

        [warning] = result.issues
        assert warning.severity == ConfigIssueSeverity.warning
        assert warning.type == "unknown_event"
        assert warning.loc == ["body", "meters", 0, "filter", "clauses", 0, "value"]
        assert warning.input == METER_TEST_EVENT
        assert result.errors == []

    async def test_unknown_event_in_nested_filter(
        self, session: AsyncSession, organization: Organization
    ) -> None:
        nested = {
            **METER,
            "filter": {
                "conjunction": "or",
                "clauses": [
                    METER["filter"],
                    {
                        "conjunction": "and",
                        "clauses": [
                            {"property": "name", "operator": "eq", "value": "embed"}
                        ],
                    },
                ],
            },
        }

        result = await validation.check(
            session,
            organization,
            Config.model_validate({"meters": [nested]}),
            for_update=False,
        )

        assert [issue.input for issue in result.issues] == [METER_TEST_EVENT, "embed"]
        assert result.issues[1].loc == [
            "body",
            "meters",
            0,
            "filter",
            "clauses",
            1,
            "clauses",
            0,
            "value",
        ]
