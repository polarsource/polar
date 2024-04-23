from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry

# Expose a dummy logger config dictionary to be used by the arq CLI.
# This way, we can get rid of its default configuration.
silent_logger_config_dict = {"version": 1, "disable_existing_loggers": False}

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)

from polar.receivers import *  # noqa
from polar.tasks import *  # noqa
from polar.worker import WorkerSettings, WorkerSettingsGitHubCrawl  # noqa
