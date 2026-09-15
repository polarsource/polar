from datetime import timedelta
from unittest.mock import AsyncMock
from uuid import UUID

import pytest
from pytest_mock import MockerFixture
from temporalio.client import (
    Schedule,
    ScheduleActionStartWorkflow,
    ScheduleAlreadyRunningError,
)

from polar.config import settings
from polar.void.meter.activities import MeterActivities
from polar.void.meter.service import meter as meter_service
from polar.void.meter.workflows import MeterCycleWorkflow
from polar.void.temporal import TASK_QUEUE
from polar.void.worker import create_worker, ensure_schedules


@pytest.mark.asyncio
class TestMeterActivities:
    @pytest.mark.parametrize("enabled", [False, True])
    async def test_disabled_or_empty_allowlist_does_not_open_session(
        self,
        mocker: MockerFixture,
        enabled: bool,
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", enabled)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", set())
        sessionmaker = mocker.Mock()
        activities = MeterActivities(sessionmaker, mocker.Mock())
        assert await activities.cycle_meters() == 0
        sessionmaker.assert_not_called()

    async def test_allowed_organizations_commit_independently(
        self,
        mocker: MockerFixture,
    ) -> None:
        first, second = UUID(int=1), UUID(int=2)
        mocker.patch.object(settings, "VOID_ENABLED", True)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", {second, first})
        sessions = [AsyncMock(), AsyncMock()]
        for session in sessions:
            session.__aenter__.return_value = session
        sessionmaker = mocker.Mock(side_effect=sessions)
        tinybird = mocker.Mock()
        cycle = mocker.patch.object(
            meter_service, "cycle", new_callable=AsyncMock, side_effect=[2, 3]
        )
        activities = MeterActivities(sessionmaker, tinybird)
        assert await activities.cycle_meters() == 5
        assert cycle.await_args_list == [
            mocker.call(sessions[0], tinybird, first),
            mocker.call(sessions[1], tinybird, second),
        ]
        for session in sessions:
            session.commit.assert_awaited_once()
            session.__aexit__.assert_awaited_once()

    async def test_failed_cycle_is_not_committed(
        self,
        mocker: MockerFixture,
    ) -> None:
        mocker.patch.object(settings, "VOID_ENABLED", True)
        mocker.patch.object(settings, "VOID_ORGANIZATION_IDS", {UUID(int=1)})
        session = AsyncMock()
        session.__aenter__.return_value = session
        mocker.patch.object(
            meter_service,
            "cycle",
            new_callable=AsyncMock,
            side_effect=RuntimeError("storage unavailable"),
        )
        with pytest.raises(RuntimeError, match="storage unavailable"):
            await MeterActivities(
                mocker.Mock(return_value=session), mocker.Mock()
            ).cycle_meters()
        session.commit.assert_not_awaited()
        session.__aexit__.assert_awaited_once()


@pytest.mark.asyncio
class TestWorkerRegistration:
    async def test_registers_existing_dispatch_and_meter_cycle_intervals(
        self,
        mocker: MockerFixture,
    ) -> None:
        client = mocker.Mock()
        client.create_schedule = AsyncMock()
        await ensure_schedules(client)
        expected = {
            "events": timedelta(seconds=1),
            "reducers": timedelta(seconds=1),
            "meter-cycles": timedelta(minutes=5),
        }
        assert client.create_schedule.await_count == 3
        for call, (name, interval) in zip(
            client.create_schedule.await_args_list, expected.items(), strict=True
        ):
            schedule_id, schedule = call.args
            assert schedule_id == f"{TASK_QUEUE}-dispatch-{name}"
            assert isinstance(schedule, Schedule)
            assert [spec.every for spec in schedule.spec.intervals] == [interval]
            assert isinstance(schedule.action, ScheduleActionStartWorkflow)
            assert schedule.action.task_queue == TASK_QUEUE
            assert schedule.action.id == schedule_id

    async def test_existing_schedules_are_idempotent(
        self, mocker: MockerFixture
    ) -> None:
        client = mocker.Mock()
        client.create_schedule = AsyncMock(side_effect=ScheduleAlreadyRunningError())
        await ensure_schedules(client)
        assert client.create_schedule.await_count == 3

    async def test_worker_registers_cycle_workflow_and_activity(
        self, mocker: MockerFixture
    ) -> None:
        worker = mocker.patch("polar.void.worker.Worker")
        create_worker(mocker.Mock(), mocker.Mock(), mocker.Mock())
        assert MeterCycleWorkflow in worker.call_args.kwargs["workflows"]
        assert "cycle_meters" in [
            activity.__name__ for activity in worker.call_args.kwargs["activities"]
        ]
