"""Stable deduplication keys for reminder emails.

These builders are the single source of truth for the `email_logs.deduplication_key`
value. The send path stores the key returned here; the reminder scanners rebuild the
same string in SQL to check whether a reminder was already sent. Keys are built from
stable identifiers (entity id + integer year/month or ISO date) — never a localized,
human-formatted date — so the format can't drift and silently re-send.
"""

from datetime import date
from uuid import UUID

from .schemas import EmailTemplate


def payment_method_expiration_reminder_key(
    payment_method_id: UUID, exp_year: int, exp_month: int
) -> str:
    return (
        f"{EmailTemplate.payment_method_expiration_reminder}"
        f":{payment_method_id}:{exp_year}-{exp_month}"
    )


def subscription_renewal_reminder_key(subscription_id: UUID, period_end: date) -> str:
    return (
        f"{EmailTemplate.subscription_renewal_reminder}"
        f":{subscription_id}:{period_end.isoformat()}"
    )


def subscription_trial_conversion_reminder_key(
    subscription_id: UUID, trial_end: date
) -> str:
    return (
        f"{EmailTemplate.subscription_trial_conversion_reminder}"
        f":{subscription_id}:{trial_end.isoformat()}"
    )
