from collections.abc import Iterator
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Event
from unittest.mock import MagicMock

import pytest
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from pytest_mock import MockerFixture
from sqlalchemy import Engine, create_engine, delete

from polar.kit.utils import utc_now
from polar.models import ScheduledCron
from polar.worker._cron import RETRY_DELAY, CronJobStore
from tests.fixtures.database import get_database_url

NOW = datetime(2026, 11, 10, 13, 30, tzinfo=UTC)
JOB_NAME = "test.cron"
TRIGGERS = [(JOB_NAME, CronTrigger(minute="*", timezone=UTC))]


@pytest.fixture
def engine(worker_id: str) -> Iterator[Engine]:
    engine = create_engine(get_database_url(worker_id, "psycopg"))
    yield engine
    with engine.begin() as connection:
        connection.execute(delete(ScheduledCron))
    engine.dispose()


@pytest.fixture
def send(mocker: MockerFixture) -> MagicMock:
    get_broker = mocker.patch("polar.worker._cron.dramatiq.get_broker")
    send: MagicMock = get_broker.return_value.get_actor.return_value.send
    return send


@pytest.fixture
def store(engine: Engine, mocker: MockerFixture) -> CronJobStore:
    mocker.patch("polar.worker._cron.utc_now", return_value=NOW)
    store = CronJobStore(engine, TRIGGERS)
    store.start(BackgroundScheduler(), "cron")
    return store


class TestStart:
    def test_restart_keeps_missed_fire_due(
        self, store: CronJobStore, engine: Engine, mocker: MockerFixture
    ) -> None:
        later = NOW + timedelta(minutes=3)
        mocker.patch("polar.worker._cron.utc_now", return_value=later)
        successor = CronJobStore(engine, TRIGGERS)
        successor.start(BackgroundScheduler(), "cron")

        jobs = successor.get_due_jobs(later)

        assert [(job.id, job.next_run_time) for job in jobs] == [(JOB_NAME, NOW)]

    def test_changed_trigger_reschedules_from_now(
        self, store: CronJobStore, engine: Engine, mocker: MockerFixture
    ) -> None:
        later = NOW + timedelta(minutes=3)
        mocker.patch("polar.worker._cron.utc_now", return_value=later)
        successor = CronJobStore(
            engine, [(JOB_NAME, CronTrigger(hour=4, minute=0, timezone=UTC))]
        )
        successor.start(BackgroundScheduler(), "cron")

        assert successor.get_due_jobs(later) == []
        assert successor.get_next_run_time() == datetime(2026, 11, 11, 4, tzinfo=UTC)


class TestUpdateJob:
    def test_sends_once_and_advances_cursor(
        self, store: CronJobStore, send: MagicMock
    ) -> None:
        job = store.get_due_jobs(NOW)[0]
        job._modify(next_run_time=NOW + timedelta(minutes=1))

        store.update_job(job)
        store.update_job(job)

        assert send.call_count == 1
        assert store.get_due_jobs(NOW) == []
        assert store.get_next_run_time() == NOW + timedelta(minutes=1)

    def test_concurrent_schedulers_send_once(
        self, store: CronJobStore, engine: Engine, send: MagicMock
    ) -> None:
        other = CronJobStore(engine, TRIGGERS)
        other.start(BackgroundScheduler(), "cron")
        jobs = [s.get_due_jobs(NOW)[0] for s in (store, other)]
        for job in jobs:
            job._modify(next_run_time=NOW + timedelta(minutes=1))
        sending = Event()
        resume = Event()

        def blocked_send() -> None:
            sending.set()
            assert resume.wait(5)

        send.side_effect = blocked_send
        with ThreadPoolExecutor(max_workers=2) as pool:
            first = pool.submit(store.update_job, jobs[0])
            try:
                assert sending.wait(5)
                second = pool.submit(other.update_job, jobs[1])
                with pytest.raises(TimeoutError):
                    second.result(timeout=0.5)
            finally:
                resume.set()
            first.result(timeout=5)
            second.result(timeout=5)

        assert send.call_count == 1

    def test_failed_send_keeps_cron_due_and_backs_off(
        self, store: CronJobStore, send: MagicMock, mocker: MockerFixture
    ) -> None:
        capture_exception = mocker.patch(
            "polar.worker._cron.sentry_sdk.capture_exception"
        )
        send.side_effect = RuntimeError("queue unavailable")
        job = store.get_due_jobs(NOW)[0]
        job._modify(next_run_time=NOW + timedelta(minutes=1))

        store.update_job(job)
        store.update_job(job)

        assert send.call_count == 1
        capture_exception.assert_called_once()
        assert store.get_due_jobs(NOW) == []
        assert store.get_next_run_time() == NOW + RETRY_DELAY
        retried = store.get_due_jobs(NOW + RETRY_DELAY)
        assert [job.next_run_time for job in retried] == [NOW]


class TestScheduler:
    def test_due_cron_is_sent_by_running_scheduler(
        self, engine: Engine, send: MagicMock, mocker: MockerFixture
    ) -> None:
        started_at = utc_now()
        mocker.patch(
            "polar.worker._cron.utc_now",
            return_value=started_at - timedelta(minutes=2),
        )
        fired = Event()
        send.side_effect = fired.set
        store = CronJobStore(engine, TRIGGERS)
        scheduler = BackgroundScheduler()
        scheduler.add_jobstore(store, "cron")

        scheduler.start()
        try:
            assert fired.wait(5)
        finally:
            scheduler.shutdown()

        assert store.get_due_jobs(started_at) == []
