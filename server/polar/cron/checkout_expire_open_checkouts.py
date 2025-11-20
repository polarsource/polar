from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue expiry of open checkouts.
    """
    enqueue_job("checkout.expire_open_checkouts")


