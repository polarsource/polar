from polar.auth.models import AuthSubject, Customer, Member
from polar.customer_seat.schemas import SeatAssign
from polar.exceptions import BadRequest, ResourceNotFound
from polar.kit.db.postgres import AsyncSession
from polar.models import Order, Subscription
from polar.order.repository import OrderRepository
from polar.subscription.repository import SubscriptionRepository


class CustomerSeatService:
    async def resolve_assign_container(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Customer | Member],
        seat_assign: SeatAssign,
    ) -> Subscription | Order:
        subscription_repository = SubscriptionRepository.from_session(session)
        order_repository = OrderRepository.from_session(session)

        if seat_assign.subscription_id:
            subscription_statement = (
                subscription_repository.get_readable_statement(auth_subject)
                .where(Subscription.id == seat_assign.subscription_id)
                .options(*subscription_repository.get_eager_options())
            )
            subscription = await subscription_repository.get_one_or_none(
                subscription_statement
            )
            if not subscription:
                raise ResourceNotFound("Subscription not found")
            return subscription

        if seat_assign.order_id:
            order_statement = (
                order_repository.get_readable_statement(auth_subject)
                .where(Order.id == seat_assign.order_id)
                .options(*order_repository.get_eager_options())
            )
            order = await order_repository.get_one_or_none(order_statement)
            if not order:
                raise ResourceNotFound("Order not found")
            return order

        if seat_assign.checkout_id:
            subscription_statement = (
                subscription_repository.get_readable_statement(auth_subject)
                .where(Subscription.checkout_id == seat_assign.checkout_id)
                .options(*subscription_repository.get_eager_options())
            )
            subscription = await subscription_repository.get_one_or_none(
                subscription_statement
            )
            if subscription:
                return subscription

            order_statement = (
                order_repository.get_readable_statement(auth_subject)
                .where(Order.checkout_id == seat_assign.checkout_id)
                .order_by(Order.created_at.asc())
                .limit(1)
                .options(*order_repository.get_eager_options())
            )
            order = await order_repository.get_one_or_none(order_statement)
            if order:
                return order
            raise ResourceNotFound("No subscription or order found for this checkout")

        raise BadRequest("Either subscription_id, order_id, or checkout_id is required")


customer_seat = CustomerSeatService()
