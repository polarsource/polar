from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue processing of due dunning orders.
    """
    enqueue_job("order.process_dunning")


