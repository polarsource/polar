from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue deletion of expired auth artifacts.
    """
    enqueue_job("auth.delete_expired")


