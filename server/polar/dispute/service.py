import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.enums import PaymentProcessor
from polar.exceptions import PolarError
from polar.integrations.chargeback_stop.types import ChargebackStopAlert
from polar.integrations.stripe.service import stripe as stripe_service
from polar.integrations.stripe.utils import get_expandable_id
from polar.models import Dispute, Order, Payment
from polar.models.dispute import DisputeAlertProcessor, DisputeStatus
from polar.payment.repository import PaymentRepository
from polar.postgres import AsyncSession
from polar.transaction.service.dispute import (
    dispute_transaction as dispute_transaction_service,
)

from .repository import DisputeRepository


class DisputeError(PolarError):
    pass


class DisputePaymentNotFoundError(DisputeError):
    def __init__(self, processor: PaymentProcessor, processor_id: str) -> None:
        self.processor = processor
        self.processor_id = processor_id
        message = (
            f"Dispute payment not found for processor {processor} "
            f"and processor_id {processor_id}."
        )
        super().__init__(message)


class DisputeService:
    async def upsert_from_stripe(
        self, session: AsyncSession, stripe_dispute: stripe_lib.Dispute
    ) -> Dispute:
        repository = DisputeRepository.from_session(session)
        dispute = await repository.get_by_payment_processor_dispute_id(
            PaymentProcessor.stripe, stripe_dispute.id
        )

        if dispute is None:
            payment, order = await self._get_payment_and_order_from_processor_id(
                session,
                PaymentProcessor.stripe,
                get_expandable_id(stripe_dispute.charge),
            )
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

    async def upsert_from_chargeback_stop(
        self, session: AsyncSession, alert: ChargebackStopAlert
    ) -> Dispute:
        repository = DisputeRepository.from_session(session)

        # Chargeback Stop uses PaymentIntent ID, but we use Charge ID
        payment_intent_id = alert["integration_transaction_id"]
        payment_intent = await stripe_service.get_payment_intent(payment_intent_id)
        latest_charge = payment_intent.latest_charge
        assert latest_charge is not None
        charge_id = get_expandable_id(latest_charge)

        # First try to find by alert processor ID
        dispute = await repository.get_by_alert_processor_id(
            DisputeAlertProcessor.chargeback_stop, alert["id"]
        )
        # Then try to find by matching payment info, in case Stripe already pinged us about the dispute
        if dispute is None:
            dispute = await repository.get_matching_by_dispute_alert(
                PaymentProcessor.stripe,
                charge_id,
                alert["transaction_amount_in_cents"],
                alert["transaction_currency_code"].lower(),
            )

        if dispute is None:
            payment, order = await self._get_payment_and_order_from_processor_id(
                session, PaymentProcessor.stripe, charge_id
            )
            amount, tax_amount = order.calculate_refunded_tax(
                alert["transaction_amount_in_cents"]
            )
            dispute = await repository.create(
                Dispute(
                    amount=amount,
                    tax_amount=tax_amount,
                    currency=alert["transaction_currency_code"].lower(),
                    payment_processor=PaymentProcessor.stripe,
                    payment_processor_id=None,  # We don't know the dispute ID yet
                    order=order,
                    payment=payment,
                )
            )

        dispute.dispute_alert_processor = DisputeAlertProcessor.chargeback_stop
        dispute.dispute_alert_processor_id = alert["id"]

        # We refunded the transaction before the dispute could be escalated
        if alert["transaction_refund_outcome"] == "REFUNDED":
            dispute.status = DisputeStatus.prevented
        # We didn't take action: the dispute will be escalated, we'll get news from Stripe later
        else:
            dispute.status = DisputeStatus.early_warning

        return await repository.update(dispute)

    async def _get_payment_and_order_from_processor_id(
        self, session: AsyncSession, processor: PaymentProcessor, processor_id: str
    ) -> tuple[Payment, Order]:
        payment_repository = PaymentRepository.from_session(session)
        payment = await payment_repository.get_by_processor_id(
            PaymentProcessor.stripe, processor_id, options=(joinedload(Payment.order),)
        )
        if payment is None or payment.order is None:
            raise DisputePaymentNotFoundError(processor, processor_id)
        return payment, payment.order


dispute = DisputeService()
