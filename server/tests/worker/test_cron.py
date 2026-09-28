import datetime

import dramatiq

import polar.tasks  # noqa: F401 — imported so every actor is declared on the broker
from polar.worker import CronTrigger, MaintenanceWindow
from polar.worker._cron import resolve_cron_triggers


def test_maintenance_window_is_stable_and_spaced() -> None:
    declarations = [
        ("zulu", MaintenanceWindow()),
        ("alpha", MaintenanceWindow()),
        ("hourly", CronTrigger(minute=15)),
    ]

    resolved = resolve_cron_triggers(declarations)

    assert resolved["hourly"] is declarations[2][1]
    assert str(resolved["alpha"].fields[6]) == "20"
    assert str(resolved["zulu"].fields[6]) == "40"
    assert (
        resolve_cron_triggers(reversed(declarations))["alpha"].fields[6]
        == (resolved["alpha"].fields[6])
    )


def test_maintenance_window_shares_minutes_on_overflow() -> None:
    declarations = [(f"{index:03}", MaintenanceWindow()) for index in range(120)]

    resolved = resolve_cron_triggers(declarations)

    minutes = [int(str(trigger.fields[6])) for trigger in resolved.values()]
    assert len(minutes) == 120
    assert all(str(trigger.fields[5]) == "4" for trigger in resolved.values())
    assert sorted(set(minutes)) == list(range(60))


def test_maintenance_window_spacing_changes_with_job_count() -> None:
    single = resolve_cron_triggers([("alpha", MaintenanceWindow())])
    three = resolve_cron_triggers(
        [(name, MaintenanceWindow()) for name in ("alpha", "bravo", "charlie")]
    )

    assert str(single["alpha"].fields[6]) == "30"
    assert [str(three[name].fields[6]) for name in ("alpha", "bravo", "charlie")] == [
        "15",
        "30",
        "45",
    ]


def test_registered_triggers_run_in_utc_and_maintenance_jobs_follow_the_window() -> (
    None
):
    declarations = {
        actor.actor_name: trigger
        for actor in dramatiq.get_broker().actors.values()
        if (trigger := actor.options.get("cron_trigger")) is not None
    }
    assert declarations
    maintenance_jobs = {
        name
        for name, trigger in declarations.items()
        if isinstance(trigger, MaintenanceWindow)
    }
    assert maintenance_jobs

    resolved = resolve_cron_triggers(declarations.items())
    minutes = []
    for name, trigger in resolved.items():
        assert trigger.timezone == datetime.UTC, name
        if name in maintenance_jobs:
            fields = {field.name: str(field) for field in trigger.fields}
            assert fields["hour"] == "4"
            assert fields["day_of_week"] == "*"
            minutes.append(int(fields["minute"]))

    assert sorted(minutes) == [
        (index + 1) * 60 // (len(maintenance_jobs) + 1)
        for index in range(len(maintenance_jobs))
    ]
