from polar import tasks
from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

__all__ = ["tasks"]
