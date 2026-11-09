from datetime import date
from uuid import UUID

from polar.email.deduplication import (
    payment_method_expiration_reminder_key,
    subscription_renewal_reminder_key,
    subscription_trial_conversion_reminder_key,
)

_ID = UUID("01942f38-d81f-7cd7-a40e-a80ae5e3cecd")


def test_payment_method_expiration_reminder_key() -> None:
    assert (
        payment_method_expiration_reminder_key(_ID, 2026, 4)
        == f"payment_method_expiration_reminder:{_ID}:2026-4"
    )


def test_subscription_renewal_reminder_key() -> None:
    assert (
        subscription_renewal_reminder_key(_ID, date(2026, 7, 5))
        == f"subscription_renewal_reminder:{_ID}:2026-07-05"
    )


def test_subscription_trial_conversion_reminder_key() -> None:
    assert (
        subscription_trial_conversion_reminder_key(_ID, date(2026, 12, 31))
        == f"subscription_trial_conversion_reminder:{_ID}:2026-12-31"
    )
