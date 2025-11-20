from __future__ import annotations

from polar.worker import enqueue_job


def main() -> None:
    """
    Vercel cron entrypoint: enqueue deletion of expired email update records.
    """
    enqueue_job("email_update.delete_expired_record")


