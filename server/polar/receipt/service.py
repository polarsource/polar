from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import AsyncSession
from polar.models import Order
from polar.order.repository import OrderRepository
from polar.payment.repository import PaymentRepository

RECEIPT_NUMBER_PREFIX = "RCPT"


class ReceiptService:
    async def allocate(self, session: AsyncSession, order: Order) -> Order:
        """Allocate ``receipt_number`` for ``order``.

        Idempotent under concurrent calls: the row-level lock plus the
        post-lock null-check prevents double-allocation.
        """
        if not order.organization.is_receipts_enabled:
            return order

        if order.receipt_number is not None:
            return order

        payment_repository = PaymentRepository.from_session(session)
        succeeded_payment = await payment_repository.get_succeeded_by_order(order.id)
        if succeeded_payment is None:
            return order

        order_repository = OrderRepository.from_session(session)
        current_number = await order_repository.lock_for_receipt_allocation(order.id)
        # Another transaction may have allocated between the null-check above
        # and this lock acquisition.
        if current_number is not None:
            order.receipt_number = current_number
            return order

        customer_repository = CustomerRepository.from_session(session)
        number = await customer_repository.increment_receipt_next_number(
            order.customer_id
        )
        order.receipt_number = (
            f"{RECEIPT_NUMBER_PREFIX}-{order.customer.short_id_str}-{number:04d}"
        )

        return order


receipt = ReceiptService()
