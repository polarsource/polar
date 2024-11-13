import argparse
import multiprocessing
import os
import signal
import sys
from types import FrameType

import structlog
from arq import run_worker as arq_run_worker

from polar.logfire import configure_logfire
from polar.logging import Logger
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
    try:
        scheduler.run()
    except KeyboardInterrupt:
        pass


def _run_worker(settings_cls: type[WorkerSettings]) -> None:
    from polar import tasks, receivers  # noqa

    pid = multiprocessing.current_process().pid
    queue = settings_cls.queue_name
    structlog.contextvars.bind_contextvars(pid=pid, queue=queue)

    arq_run_worker(settings_cls)  # type: ignore


def _main(default_worker_num: int = 1, github_worker_num: int = 1) -> int:
    running = True

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

    def stop_processes(signum: signal.Signals) -> None:
        logger.debug("Stopping worker processes")
        nonlocal running
        running = False

        for p in processes:
            logger.debug(f"Stopping process {p.pid}")
            if p.pid is None:
                continue
            try:
                os.kill(p.pid, signum.value)
                logger.debug(f"Sent signal {signum} to process {p.pid}")
            except OSError:
                if p.exitcode is None:
                    logger.warning(f"Failed to kill process {p.pid}")

    def handle_signal(signum: int, frame: FrameType | None) -> None:
        logger.info(f"Received signal {signum}, shutting down worker processes")
        stop_processes(signal.Signals(signum))

    for sig in {signal.SIGTERM, signal.SIGINT}:
        signal.signal(sig, handle_signal)

    # Wait for all processes to exit.
    # If a process terminates abnormally, shutdown everything.
    # `waited` here avoids a race condition where the processes could potentially exit
    # before we even get a chance to wait on them.
    # Inspired from: https://github.com/Bogdanp/dramatiq/blob/382534702db167192dfd91d5e751b7f3aafacd3b/dramatiq/cli.py#L575-L615
    exit_code = 0
    waited = False
    while not waited or any(p.exitcode is None for p in processes):
        waited = True
        for p in processes:
            p.join(timeout=1)
            if p.exitcode is None:
                continue

            if running:
                logger.error(
                    f"Worker process {p.pid} exited with code {p.exitcode}. "
                    "Shutting down."
                )
                stop_processes(signal.SIGTERM)
            else:
                exit_code = exit_code or p.exitcode

    logger.info("All worker processes stopped.", exit_code=exit_code)
    return exit_code


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

    sys.exit(_main(args.default_worker_num, args.github_worker_num))
