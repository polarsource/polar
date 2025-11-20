from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue meter billing aggregation.
    """
    enqueue_job("meter.enqueue_billing")


