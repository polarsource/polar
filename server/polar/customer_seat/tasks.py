import uuid

import structlog

from polar.exceptions import PolarTaskError
from polar.logging import Logger
from polar.product.repository import ProductRepository
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import CustomerSeatRepository
from .service import seat_service

log: Logger = structlog.get_logger()


class SeatTaskError(PolarTaskError): ...


class ProductDoesNotExist(SeatTaskError):
    def __init__(self, product_id: uuid.UUID) -> None:
        self.product_id = product_id
        message = f"The product with id {product_id} does not exist."
        super().__init__(message)


@actor(actor_name="customer_seat.revoke_seats_for_member", priority=TaskPriority.MEDIUM)
async def revoke_seats_for_member(member_id: uuid.UUID) -> None:
    """Revoke all active seats for a member."""
    async with AsyncSessionMaker() as session:
        repository = CustomerSeatRepository.from_session(session)
        active_seats = await repository.list_active_by_member_id(
            member_id, options=repository.get_eager_options()
        )

        if not active_seats:
            log.info(
                "customer_seat.revoke_seats_for_member.no_seats",
                member_id=member_id,
            )
            return

        for seat in active_seats:
            await seat_service.revoke_seat(session, seat)
            log.info(
                "customer_seat.revoke_seats_for_member.seat_revoked",
                member_id=member_id,
                seat_id=seat.id,
            )

        log.info(
            "customer_seat.revoke_seats_for_member.completed",
            member_id=member_id,
            seats_revoked=len(active_seats),
        )


@actor(
    actor_name="customer_seat.update_product_benefits_grants",
    priority=TaskPriority.MEDIUM,
)
async def update_product_benefits_grants(product_id: uuid.UUID) -> None:
    """Re-sync benefit grants for all claimed seats of a product."""
    async with AsyncSessionMaker() as session:
        product_repository = ProductRepository.from_session(session)
        product = await product_repository.get_by_id(product_id)
        if product is None:
            raise ProductDoesNotExist(product_id)

        await seat_service.update_product_benefits_grants(session, product)
