import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.declarative_config.schemas import Config, ConfigAction
from polar.declarative_config.service import (
    ConfigAsCodeNotEnabled,
    ConfigMeterConflict,
    ConfigMeterLocked,
)
from polar.declarative_config.service import (
    declarative_config as declarative_config_service,
)
from polar.meter.repository import MeterRepository
from polar.meter.unit import MeterUnit
from polar.models import Organization
from polar.postgres import AsyncSession
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_event,
    create_meter,
)

TOOL_CALLS_METER = {
    "external_id": "sdk-tool-calls",
    "name": "SDK - Tool Calls",
    "filter": {
        "conjunction": "and",
        "clauses": [
            {
                "conjunction": "or",
                "clauses": [
                    {"property": "name", "operator": "eq", "value": "tool_call"}
                ],
            }
        ],
    },
    "aggregation": {"func": "count"},
    "unit": "custom",
    "custom_label": "call",
    "custom_multiplier": None,
}

FIXTURE_METER = {
    "external_id": "my-meter",
    "name": "My Meter",
    "filter": {
        "conjunction": "and",
        "clauses": [{"property": "name", "operator": "eq", "value": METER_TEST_EVENT}],
    },
    "aggregation": {"func": "count"},
}


@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestApply:
    async def test_not_enabled(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        with pytest.raises(ConfigAsCodeNotEnabled):
            await declarative_config_service.apply(
                session, auth_subject, Config.model_validate({"meters": []})
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_create(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session, auth_subject, Config.model_validate({"meters": [TOOL_CALLS_METER]})
        )

        assert result.meters[0].action == ConfigAction.created
        [meter] = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["sdk-tool-calls"]
        )
        assert meter.name == "SDK - Tool Calls"
        assert meter.unit == MeterUnit.custom
        assert meter.custom_label == "call"
        enqueue_job_mock.assert_called_once_with("meter.backfill_events", meter.id)

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_unchanged(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session, auth_subject, Config.model_validate({"meters": [FIXTURE_METER]})
        )

        assert result.meters[0].action == ConfigAction.unchanged
        enqueue_job_mock.assert_not_called()

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )

        result = await declarative_config_service.apply(
            session, auth_subject, Config.model_validate({"meters": [TOOL_CALLS_METER]})
        )

        assert result.meters[0].action == ConfigAction.updated
        assert meter.name == "SDK - Tool Calls"
        assert meter.unit == MeterUnit.custom
        assert meter.custom_label == "call"
        assert meter.filter.model_dump() == TOOL_CALLS_METER["filter"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_ignores_other_organization_meter(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization_second: Organization,
    ) -> None:
        other_meter = await create_meter(
            save_fixture, organization=organization_second, external_id="sdk-tool-calls"
        )
        mocker.patch("polar.meter.service.enqueue_job")

        result = await declarative_config_service.apply(
            session, auth_subject, Config.model_validate({"meters": [TOOL_CALLS_METER]})
        )

        assert result.meters[0].action == ConfigAction.created
        assert other_meter.name == "My Meter"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_aggregating_meter_aggregation_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        with pytest.raises(ConfigMeterLocked) as exc_info:
            await declarative_config_service.apply(
                session,
                auth_subject,
                Config.model_validate(
                    {
                        "meters": [
                            {
                                **FIXTURE_METER,
                                "aggregation": {"func": "sum", "property": "tokens"},
                            }
                        ]
                    }
                ),
            )

        [error] = exc_info.value.errors
        assert error.loc == ["body", "meters", 0, "aggregation"]

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_aggregating_meter_name_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        result = await declarative_config_service.apply(
            session,
            auth_subject,
            Config.model_validate({"meters": [{**FIXTURE_METER, "name": "Renamed"}]}),
        )

        assert result.meters[0].action == ConfigAction.updated
        assert meter.name == "Renamed"

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_omitted_metadata_keeps_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            user_metadata={"team": "sdk"},
        )

        result = await declarative_config_service.apply(
            session, auth_subject, Config.model_validate({"meters": [FIXTURE_METER]})
        )

        assert result.meters[0].action == ConfigAction.unchanged
        assert meter.user_metadata == {"team": "sdk"}

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_metadata_update(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            user_metadata={"team": "sdk"},
        )

        result = await declarative_config_service.apply(
            session,
            auth_subject,
            Config.model_validate(
                {"meters": [{**FIXTURE_METER, "metadata": {"team": "billing"}}]}
            ),
        )

        assert result.meters[0].action == ConfigAction.updated
        assert meter.user_metadata == {"team": "billing"}

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_concurrent_create(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        await create_meter(
            save_fixture, organization=organization, external_id="sdk-tool-calls"
        )
        mocker.patch(
            "polar.declarative_config.service.MeterRepository.get_all_by_external_ids",
            return_value=[],
        )
        mocker.patch("polar.meter.service.enqueue_job")

        with pytest.raises(ConfigMeterConflict):
            await declarative_config_service.apply(
                session,
                auth_subject,
                Config.model_validate({"meters": [TOOL_CALLS_METER]}),
            )


@pytest.mark.asyncio
@pytest.mark.auth(AuthSubjectFixture(subject="organization"))
class TestValidate:
    async def test_not_enabled(
        self, session: AsyncSession, auth_subject: AuthSubject[Organization]
    ) -> None:
        with pytest.raises(ConfigAsCodeNotEnabled):
            await declarative_config_service.validate(
                session, auth_subject, Config.model_validate({"meters": []})
            )

    @pytest.mark.usefixtures("config_as_code_enabled")
    async def test_reports_locked_meter_without_applying(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        result = await declarative_config_service.validate(
            session,
            auth_subject,
            Config.model_validate(
                {
                    "meters": [
                        {
                            **FIXTURE_METER,
                            "name": "Renamed",
                            "aggregation": {"func": "sum", "property": "tokens"},
                        }
                    ]
                }
            ),
        )

        assert [(issue.type, issue.loc) for issue in result.issues] == [
            ("meter_locked", ["body", "meters", 0, "aggregation"]),
            ("unknown_event", ["body", "meters", 0, "filter", "clauses", 0, "value"]),
        ]
        assert meter.name == "My Meter"
