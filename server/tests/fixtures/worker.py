from datetime import datetime

import pytest
from arq import ArqRedis
from polar.worker import JobContext, PolarWorkerContext


@pytest.fixture
def job_context() -> JobContext:
    return {
        "redis": ArqRedis(),
        "job_id": "fake_job_id",
        "job_try": 1,
        "enqueue_time": datetime.utcnow(),
        "score": 0,
    }


@pytest.fixture
def polar_worker_context() -> PolarWorkerContext:
    return PolarWorkerContext()
