import datetime

import dramatiq
import pytest

import polar.tasks  # noqa: F401 — imported so every actor is declared on the broker
from polar.worker import CronTrigger


@pytest.fixture
def cron_actors() -> list[tuple[str, CronTrigger]]:
    actors = [
        (actor.actor_name, cron_trigger)
        for actor in dramatiq.get_broker().actors.values()
        if (cron_trigger := actor.options.get("cron_trigger")) is not None
    ]
    assert actors
    return actors


def test_triggers_run_in_utc(cron_actors: list[tuple[str, CronTrigger]]) -> None:
    for actor_name, cron_trigger in cron_actors:
        assert cron_trigger.timezone == datetime.UTC, (
            f"{actor_name} is scheduled in {cron_trigger.timezone}"
        )


def test_daily_jobs_have_their_own_maintenance_window_slot(
    cron_actors: list[tuple[str, CronTrigger]],
) -> None:
    slots: dict[str, str] = {}
    for actor_name, cron_trigger in cron_actors:
        fields = {field.name: str(field) for field in cron_trigger.fields}
        if fields["hour"] != "4" or fields["day_of_week"] != "*":
            continue
        minute = fields["minute"]
        assert minute not in slots, (
            f"{actor_name} shares slot 04:{minute} with {slots[minute]}"
        )
        slots[minute] = actor_name
