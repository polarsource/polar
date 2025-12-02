import os

from polar.config import settings

# Setup multiprocess prometheus directory before importing prometheus_client
# This enables metrics to be shared across worker processes (main + forked health server)
prometheus_dir = settings.WORKER_PROMETHEUS_DIR
prometheus_dir.mkdir(parents=True, exist_ok=True)
os.environ["PROMETHEUS_MULTIPROC_DIR"] = str(prometheus_dir)

from prometheus_client import (  # noqa: E402 we need to set the environment variable before importing
    Counter,
    Histogram,
)

# Task metrics
TASK_EXECUTIONS = Counter(
    "polar_task_executions_total",
    "Total number of task executions",
    ["task_name", "status"],
)

TASK_DURATION = Histogram(
    "polar_task_duration_seconds",
    "Task execution duration in seconds",
    ["task_name"],
    buckets=(0.1, 0.25, 0.5, 1.0, 2.5, 5.0, 10.0, 30.0, 60.0, 120.0),
)

TASK_RETRIES = Counter(
    "polar_task_retries_total",
    "Total number of task retries",
    ["task_name"],
)
