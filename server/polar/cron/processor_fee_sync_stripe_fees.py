from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue syncing of Stripe processor fees.
    """
    enqueue_job("processor_fee.sync_stripe_fees")


