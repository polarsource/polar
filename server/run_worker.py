from polar import tasks
from polar.logfire import configure_logfire, instrument_redis
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.worker import broker

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)
instrument_redis()

__all__ = ["tasks", "broker"]
