from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.worker import CronTasksScheduler

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

__all__ = ["tasks"]

if __name__ == "__main__":
    scheduler = CronTasksScheduler()
    try:
        scheduler.run()
    except KeyboardInterrupt:
        pass
