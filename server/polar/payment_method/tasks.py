import uuid
from datetime import timedelta

from polar.kit.utils import utc_now
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    enqueue_job,
)

from .repository import PaymentMethodRepository
from .service import PaymentMethodDoesNotExist
from .service import payment_method as payment_method_service

# Cards expire at the end of their month, so a 30 day window would always fire on
# the 1st — where the reminder competes with everyone's monthly billing emails.
EXPIRATION_REMINDER_WINDOW = timedelta(days=20)


@actor(
    actor_name="payment_method.scan_expiration_reminders",
    cron_trigger=CronTrigger.from_crontab("45 * * * *"),
    priority=TaskPriority.LOW,
)
async def scan_expiration_reminders() -> None:
    """Scan for soon-to-expire cards needing a reminder and fan out."""
    now = utc_now()
    window_end = now + EXPIRATION_REMINDER_WINDOW

    async with AsyncSessionMaker() as session:
        repository = PaymentMethodRepository.from_session(session)
        payment_methods = await repository.get_cards_needing_expiration_reminder(
            now, window_end
        )

    for payment_method in payment_methods:
        enqueue_job("payment_method.send_expiration_reminder", payment_method.id)


@actor(actor_name="payment_method.send_expiration_reminder", priority=TaskPriority.LOW)
async def send_expiration_reminder(payment_method_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = PaymentMethodRepository.from_session(session)
        payment_method = await repository.get_by_id(
            payment_method_id, options=repository.get_eager_options()
        )
        if payment_method is None:
            raise PaymentMethodDoesNotExist(payment_method_id)

        await payment_method_service.send_expiration_reminder_email(
            session, payment_method
        )
