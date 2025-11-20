from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue deletion of expired customer sessions.
    """
    enqueue_job("customer_session.delete_expired")


