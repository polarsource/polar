import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Dispute, Payment
from polar.models.dispute import DisputeStatus
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)

from .repository import DisputeRepository


class DisputeError(PolarError):
    pass


class DisputePaymentNotFoundError(DisputeError):
    def __init__(self, dispute_id: str, charge_id: str) -> None:
        self.dispute_id = dispute_id
        self.charge_id = charge_id
        super().__init__(
            f"Payment or order not found for dispute {dispute_id} and charge {charge_id}"
        )


class DisputeService:
    async def upsert_from_stripe(
        self, session: AsyncSession, stripe_dispute: stripe_lib.Dispute
    ) -> Dispute:
        repository = DisputeRepository.from_session(session)
        dispute = await repository.get_by_payment_processor_id(
            PaymentProcessor.stripe, stripe_dispute.id
        )

        if dispute is None:
            payment_repository = PaymentRepository.from_session(session)
            charge_id = get_expandable_id(stripe_dispute.charge)
            payment = await payment_repository.get_by_processor_id(
                PaymentProcessor.stripe, charge_id, options=(joinedload(Payment.order),)
            )
            if payment is None or payment.order is None:
                raise DisputePaymentNotFoundError(stripe_dispute.id, charge_id)

            order = payment.order
            amount, tax_amount = order.calculate_refunded_tax(stripe_dispute.amount)
            dispute = await repository.create(
                Dispute(
                    amount=amount,
                    tax_amount=tax_amount,
                    currency=stripe_dispute.currency,
                    payment_processor=PaymentProcessor.stripe,
                    payment_processor_id=stripe_dispute.id,
                    order=order,
                    payment=payment,
                )
            )

        dispute.status = DisputeStatus.from_stripe(stripe_dispute.status)
        dispute = await repository.update(dispute)

        # If won or lost, record the transactions
        if dispute.closed:
            await dispute_transaction_service.create_dispute(session, dispute=dispute)

        return dispute


dispute = DisputeService()
