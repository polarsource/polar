from apscheduler.schedulers.blocking import BlockingScheduler

from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.worker import scheduler_middleware

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)


def start() -> None:
    scheduler = BlockingScheduler()

    for func, cron_trigger in scheduler_middleware.cron_triggers:
        scheduler.add_job(func, cron_trigger)

    try:
        scheduler.start()
    except KeyboardInterrupt:
        scheduler.shutdown()


__all__ = ["tasks", "start"]
