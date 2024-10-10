import multiprocessing
import os
from logging import Logger

import structlog
from arq import run_worker as arq_run_worker

from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.worker import WorkerSettings, WorkerSettingsGitHubCrawl


def _run_worker(settings_cls: type[WorkerSettings]) -> None:
    from polar import tasks, receivers  # noqa

    configure_sentry()
    configure_logfire("worker")
    configure_logging(logfire=True)

    pid = multiprocessing.current_process().pid
    queue = settings_cls.queue_name

    structlog.contextvars.bind_contextvars(pid=pid, queue=queue)
    arq_run_worker(settings_cls)  # type: ignore


def _main() -> None:
    logger: Logger = structlog.get_logger(pid=os.getpid())
    logger.info("Starting worker processes")

    default_worker_process = multiprocessing.Process(
        target=_run_worker, args=(WorkerSettings,)
    )
    default_worker_process.start()
    logger.debug("Default worker process triggered")

    github_worker_process = multiprocessing.Process(
        target=_run_worker, args=(WorkerSettingsGitHubCrawl,)
    )
    github_worker_process.start()
    logger.debug("GitHub worker process triggered")

    try:
        default_worker_process.join()
        github_worker_process.join()
    except KeyboardInterrupt:
        logger.info("Shutting down worker processes")
        default_worker_process.terminate()
        github_worker_process.terminate()


if __name__ == "__main__":
    _main()
