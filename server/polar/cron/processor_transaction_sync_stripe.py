from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue syncing of Stripe processor transactions.
    """
    enqueue_job("processor_transaction.sync_stripe")


