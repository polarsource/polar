import uuid

from sqlalchemy.orm import joinedload

from polar.email.schemas import (
    ChargebackPreventionRefundEmail,
    ChargebackPreventionRefundProps,
)
from polar.email.sender import enqueue_email_template
from polar.models import Order, Refund
from polar.models.user_organization import OrganizationRole
from polar.user_organization.service import (
    user_organization as user_organization_service,
)
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import RefundRepository

_NOTICE_RECIPIENT_ROLES = (OrganizationRole.owner, OrganizationRole.admin)


@actor(
    actor_name="refund.send_chargeback_prevention_notice",
    priority=TaskPriority.LOW,
)
async def send_chargeback_prevention_notice(refund_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        repository = RefundRepository.from_session(session)
        refund = await repository.get_by_id(
            refund_id,
            options=(joinedload(Refund.order).joinedload(Order.customer),),
        )
        if refund is None:
            return

        order = refund.order
        if order is None:
            return

        order_number = order.invoice_number or str(order.id)
        customer_name = order.customer.display_name
        subject = f"Chargeback prevented for order {order_number}"

        members = await user_organization_service.list_by_org(
            session, order.organization_id
        )
        for member in members:
            if member.role not in _NOTICE_RECIPIENT_ROLES:
                continue
            if not member.notification_settings.get("chargeback_prevention", True):
                continue
            recipient = member.user.email
            if not recipient:
                continue
            enqueue_email_template(
                ChargebackPreventionRefundEmail(
                    props=ChargebackPreventionRefundProps(
                        email=recipient,
                        order_number=order_number,
                        customer_name=customer_name,
                        amount=refund.total_amount,
                        currency=refund.currency,
                        refund_date=refund.created_at.isoformat(),
                    )
                ),
                to_email_addr=recipient,
                subject=subject,
            )
