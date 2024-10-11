import argparse
import multiprocessing
import os
from logging import Logger

import structlog
from arq import run_worker as arq_run_worker

from polar.logfire import configure_logfire
from polar.logging import configure as configure_logging
from polar.sentry import configure_sentry
from polar.worker import CronTasksScheduler, WorkerSettings, WorkerSettingsGitHubCrawl

configure_sentry()
configure_logfire("worker")
configure_logging(logfire=True)


def _run_scheduler() -> None:
    from polar import tasks  # noqa

    pid = multiprocessing.current_process().pid
    structlog.contextvars.bind_contextvars(pid=pid)

    scheduler = CronTasksScheduler()
    scheduler.run()


def _run_worker(settings_cls: type[WorkerSettings]) -> None:
    from polar import tasks, receivers  # noqa

    pid = multiprocessing.current_process().pid
    queue = settings_cls.queue_name
    structlog.contextvars.bind_contextvars(pid=pid, queue=queue)

    arq_run_worker(settings_cls)  # type: ignore


def _main(default_worker_num: int = 1, github_worker_num: int = 1) -> None:
    logger: Logger = structlog.get_logger(pid=os.getpid())
    logger.info("Starting worker processes")

    processes: list[multiprocessing.Process] = []

    scheduler_process = multiprocessing.Process(target=_run_scheduler)
    scheduler_process.start()
    processes.append(scheduler_process)
    logger.debug("Triggered scheduler process")

    for _ in range(default_worker_num):
        default_worker_process = multiprocessing.Process(
            target=_run_worker, args=(WorkerSettings,)
        )
        default_worker_process.start()
        processes.append(default_worker_process)
    logger.debug(f"Triggered {default_worker_num} default worker processes")

    for _ in range(github_worker_num):
        github_worker_process = multiprocessing.Process(
            target=_run_worker, args=(WorkerSettingsGitHubCrawl,)
        )
        github_worker_process.start()
        processes.append(github_worker_process)
    logger.debug(f"Triggered {github_worker_num} GitHub worker processes")

    try:
        for process in processes:
            process.join()
    except KeyboardInterrupt:
        logger.info("Shutting down worker processes")
        for process in processes:
            process.terminate()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run worker processes.")
    parser.add_argument(
        "--default-worker-num",
        type=int,
        default=1,
        help="Number of default worker processes to start (default: 1)",
    )
    parser.add_argument(
        "--github-worker-num",
        type=int,
        default=1,
        help="Number of GitHub worker processes to start (default: 1)",
    )
    args = parser.parse_args()

    _main(args.default_worker_num, args.github_worker_num)
