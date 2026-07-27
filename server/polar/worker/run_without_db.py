import dramatiq

from polar.worker._broker import get_broker
from polar.worker._encoder import JSONEncoder

# Entrypoint for workers whose queues never touch PostgreSQL. Building the broker
# without the SQLAlchemy middleware avoids creating a database engine/pool the
# worker would never use. The broker must be set as the global broker before
# `polar.tasks` is imported, so actors are declared against it rather than the
# default (database-backed) broker created by `polar.worker`.
broker = get_broker(database=False)
dramatiq.set_broker(broker)
dramatiq.set_encoder(JSONEncoder(broker))

from polar import tasks  # noqa: E402
from polar.logfire import configure_logfire  # noqa: E402
from polar.logging import configure as configure_logging  # noqa: E402
from polar.posthog import configure_posthog  # noqa: E402
from polar.sentry import configure_sentry  # noqa: E402

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)
configure_posthog()

__all__ = ["broker", "tasks"]
