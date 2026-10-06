import uuid

import pytest
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.billing_config.schemas import BillingConfig, BillingConfigAction
from polar.billing_config.service import BillingConfigNotEnabled
from polar.billing_config.service import billing_config as billing_config_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.utils import utc_now
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
        with pytest.raises(BillingConfigNotEnabled):
            await billing_config_service.apply(
                session,
                auth_subject,
                BillingConfig.model_validate({"version": 1, "meters": []}),
            )

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_create(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate({"version": 1, "meters": [TOOL_CALLS_METER]}),
        )

        [meter_result] = result.meters
        assert meter_result.action == BillingConfigAction.created
        assert meter_result.meter.name == "SDK - Tool Calls"
        assert meter_result.meter.unit == MeterUnit.custom
        assert meter_result.meter.custom_label == "call"
        enqueue_job_mock.assert_called_once_with(
            "meter.backfill_events", meter_result.meter.id
        )

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_unchanged(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )
        enqueue_job_mock = mocker.patch("polar.meter.service.enqueue_job")

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate({"version": 1, "meters": [FIXTURE_METER]}),
        )

        [meter_result] = result.meters
        assert meter_result.action == BillingConfigAction.unchanged
        assert meter_result.meter.id == meter.id
        enqueue_job_mock.assert_not_called()

    @pytest.mark.usefixtures("billing_config_enabled")
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

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate({"version": 1, "meters": [TOOL_CALLS_METER]}),
        )

        [meter_result] = result.meters
        assert meter_result.action == BillingConfigAction.updated
        assert meter_result.meter.id == meter.id
        assert meter.name == "SDK - Tool Calls"
        assert meter.unit == MeterUnit.custom
        assert meter.custom_label == "call"
        assert meter.filter.model_dump() == TOOL_CALLS_METER["filter"]

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_ignores_other_organization_meter(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization_second: Organization,
    ) -> None:
        other_meter = await create_meter(
            save_fixture,
            id=uuid.uuid4(),
            organization=organization_second,
            external_id="sdk-tool-calls",
        )
        mocker.patch("polar.meter.service.enqueue_job")

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate({"version": 1, "meters": [TOOL_CALLS_METER]}),
        )

        [meter_result] = result.meters
        assert meter_result.action == BillingConfigAction.created
        assert meter_result.meter.id != other_meter.id
        assert other_meter.name == "My Meter"

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_aggregating_meter_filter_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(
            save_fixture, organization=organization, ingested_at=utc_now()
        )
        await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        with pytest.raises(PolarRequestValidationError) as exc_info:
            await billing_config_service.apply(
                session,
                auth_subject,
                BillingConfig.model_validate(
                    {
                        "version": 1,
                        "meters": [
                            {
                                **FIXTURE_METER,
                                "aggregation": {"func": "sum", "property": "tokens"},
                            }
                        ],
                    }
                ),
            )

        [error] = exc_info.value.errors()
        assert error["loc"] == ("body", "meters", 0, "aggregation")

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_aggregating_meter_name_change(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        event = await create_event(
            save_fixture, organization=organization, ingested_at=utc_now()
        )
        meter = await create_meter(
            save_fixture,
            organization=organization,
            external_id="my-meter",
            last_billed_event=event,
        )

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate(
                {"version": 1, "meters": [{**FIXTURE_METER, "name": "Renamed"}]}
            ),
        )

        assert result.meters[0].action == BillingConfigAction.updated
        assert meter.name == "Renamed"

    @pytest.mark.usefixtures("billing_config_enabled")
    async def test_omitted_metadata_keeps_existing(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        meter = await create_meter(
            save_fixture, organization=organization, external_id="my-meter"
        )
        meter.user_metadata = {"team": "sdk"}
        await save_fixture(meter)

        result = await billing_config_service.apply(
            session,
            auth_subject,
            BillingConfig.model_validate({"version": 1, "meters": [FIXTURE_METER]}),
        )

        assert result.meters[0].action == BillingConfigAction.unchanged
        assert meter.user_metadata == {"team": "sdk"}
