from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue webhook event archiving.
    """
    enqueue_job("webhook_event.archive")


