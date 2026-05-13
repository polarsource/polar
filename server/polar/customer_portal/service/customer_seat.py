from polar.auth.models import AuthSubject, Customer, Member
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Subscription
from polar.order.repository import OrderRepository
from polar.subscription.repository import SubscriptionRepository

from ..schemas.seat import CustomerSeatAssign


class CustomerSeatService:
    async def resolve_assign_container(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer | Member],
        seat_assign: CustomerSeatAssign,
    ) -> Subscription | Order:
        subscription_repository = SubscriptionRepository.from_session(session)
        order_repository = OrderRepository.from_session(session)

        if seat_assign.subscription_id:
            subscription = await subscription_repository.get_readable_by_id(
                auth_subject,
                seat_assign.subscription_id,
                options=subscription_repository.get_eager_options(),
            )
            if not subscription:
                raise ResourceNotFound("Subscription not found")
            return subscription

        if seat_assign.order_id:
            order = await order_repository.get_readable_by_id(
                auth_subject,
                seat_assign.order_id,
                options=order_repository.get_eager_options(),
            )
            if not order:
                raise ResourceNotFound("Order not found")
            return order

        if seat_assign.checkout_id:
            subscription = await subscription_repository.get_readable_by_checkout_id(
                auth_subject,
                seat_assign.checkout_id,
                options=subscription_repository.get_eager_options(),
            )
            if subscription:
                return subscription

            order = await order_repository.get_earliest_readable_by_checkout_id(
                auth_subject,
                seat_assign.checkout_id,
                options=order_repository.get_eager_options(),
            )
            if order:
                return order
            raise ResourceNotFound("No subscription or order found for this checkout")

        raise BadRequest("Either subscription_id, order_id, or checkout_id is required")


customer_seat = CustomerSeatService()
