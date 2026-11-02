import uuid
from typing import Annotated

from dramatiq import Retry

from polar.exceptions import PolarTaskError
from polar.integrations.stripe.service import stripe as stripe_service
from polar.observability.task_logging import LoggableField
from polar.payment.repository import PaymentRepository
from polar.transaction.service.payment import BalanceTransactionNotAvailableError
from polar.transaction.service.payment import (
    payment_transaction as payment_transaction_service,
)
from polar.worker import AsyncSessionMaker, CronTrigger, TaskPriority, actor, can_retry

from .repository import PaymentTransactionRepository
from .service.processor_fee import (
    BalanceTransactionNotFound,
)
from .service.processor_fee import (
    processor_fee_transaction as processor_fee_transaction_service,
)


class TransactionTaskError(PolarTaskError): ...


@actor(actor_name="transaction.create_payment", priority=TaskPriority.LOW)
async def create_payment(payment_id: Annotated[uuid.UUID, LoggableField]) -> None:
    async with AsyncSessionMaker() as session:
        payment = await PaymentRepository.from_session(session).get_by_id(payment_id)
        if payment is None:
            raise TransactionTaskError(f"Payment {payment_id} does not exist")
        charge = await stripe_service.get_charge(payment.processor_id)
        try:
            await payment_transaction_service.create_payment(session, charge=charge)
        except BalanceTransactionNotAvailableError as e:
            if can_retry():
                raise Retry() from e
            raise


class PaymentTransactionDoesNotExist(TransactionTaskError):
    def __init__(self, payment_transaction_id: uuid.UUID) -> None:
        self.payment_transaction_id = payment_transaction_id
        message = (
            f"Payment transaction with id {payment_transaction_id} does not exist."
        )
        super().__init__(message)


@actor(
    actor_name="processor_fee.sync_stripe_fees",
    cron_trigger=CronTrigger(hour=0, minute=0),
    priority=TaskPriority.LOW,
)
async def sync_stripe_fees() -> None:
    async with AsyncSessionMaker() as session:
        await processor_fee_transaction_service.sync_stripe_fees(session)


@actor(
    actor_name="processor_fee.create_payment_fees",
    priority=TaskPriority.LOW,
)
async def create_payment_fees(
    payment_transaction_id: Annotated[uuid.UUID, LoggableField],
) -> None:
    async with AsyncSessionMaker() as session:
        repository = PaymentTransactionRepository.from_session(session)
        payment_transaction = await repository.get_by_id(payment_transaction_id)
        if payment_transaction is None:
            raise PaymentTransactionDoesNotExist(payment_transaction_id)

        try:
            await processor_fee_transaction_service.create_payment_fees(
                session, payment_transaction=payment_transaction
            )
        except BalanceTransactionNotFound as e:
            # Retry because Stripe may have not created the balance transaction yet
            if can_retry():
                raise Retry() from e
            # Raise the exception to be notified about it
            else:
                raise
