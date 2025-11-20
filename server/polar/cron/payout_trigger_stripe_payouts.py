from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue Stripe payout triggering.
    """
    enqueue_job("payout.trigger_stripe_payouts")


