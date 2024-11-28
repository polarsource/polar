import argparse
import multiprocessing
import os
import signal
import sys
import threading
from types import FrameType

import structlog
from arq import check_health
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


def _worker_health_check(settings_cls: type[WorkerSettings]) -> None:
    if not settings_cls.health_check_interval:
        raise RuntimeError("Health check interval not set")

    # Because of the ARQ implementation, the health check record may be slightly delayed
    # It creates a race condition where this process may proceed with reading the health
    # check milliseconds before it's recorded.
    # To avoid this, we set the interval to be twice the health check interval.
    interval = settings_cls.health_check_interval.total_seconds() * 2

    logger: Logger = structlog.get_logger(
        "run_worker._worker_health_check",
        pid=os.getpid(),
        queue=settings_cls.queue_name,
    )
    logger.debug("Starting worker health check")
    stop_event = threading.Event()

    def handle_signal(signum: int, frame: FrameType | None) -> None:
        nonlocal stop_event
        logger.debug(f"Received signal {signum}, shutting down process")
        stop_event.set()

    for sig in {signal.SIGTERM, signal.SIGINT}:
        signal.signal(sig, handle_signal)

    worker_started = False
    while not stop_event.is_set():
        return_code = check_health(settings_cls)  # type: ignore
        if return_code != 0:
            if not worker_started:
                logger.debug("Worker not started yet, waiting")
            else:
                logger.error("Worker health check failed, shutting down")
                break
        elif not worker_started:
            worker_started = True
            logger.debug("Worker started")

        stop_event.wait(interval)


_worker_settings_class = {
    "default": WorkerSettings,
    "github": WorkerSettingsGitHubCrawl,
}


def _main(queue: str, worker_num: int = 1, scheduler: bool = False) -> int:
    running = True

    logger: Logger = structlog.get_logger(
        "run_worker._main", pid=os.getpid(), queue=queue
    )
    logger.info("Starting worker processes")

    processes: list[multiprocessing.Process] = []

    if scheduler:
        scheduler_process = multiprocessing.Process(target=_run_scheduler)
        scheduler_process.start()
        processes.append(scheduler_process)
        logger.debug("Triggered scheduler process")

    for _ in range(worker_num):
        default_worker_process = multiprocessing.Process(
            target=_run_worker, args=(_worker_settings_class[queue],)
        )
        default_worker_process.start()
        processes.append(default_worker_process)
    logger.debug(f"Triggered {worker_num} worker processes")

    health_check_process = multiprocessing.Process(
        target=_worker_health_check, args=(_worker_settings_class[queue],)
    )
    health_check_process.start()
    processes.append(health_check_process)
    logger.debug("Triggered worker health check process")

    def stop_processes(signum: signal.Signals) -> None:
        logger.debug("Stopping worker processes")
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

        nonlocal running
        running = False

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
                running = False
                logger.info(
                    f"Worker process {p.pid} exited with code {p.exitcode}. "
                    "Shutting down."
                )
                stop_processes(signal.SIGTERM)
                break
            else:
                exit_code = exit_code or p.exitcode

    logger.info("All worker processes stopped.", exit_code=exit_code)
    return exit_code


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run worker processes.")
    parser.add_argument(
        "queue",
        type=str,
        choices={"default", "github"},
        help="Name of the queue to process (default or github)",
    )
    parser.add_argument(
        "--worker-num",
        type=int,
        default=1,
        help="Number of worker processes to start (default: 1)",
    )
    parser.add_argument(
        "--scheduler",
        action=argparse.BooleanOptionalAction,
        default=False,
        help="Run the scheduler process (default: False)",
    )
    args = parser.parse_args()

    sys.exit(_main(args.queue, args.worker_num, args.scheduler))
