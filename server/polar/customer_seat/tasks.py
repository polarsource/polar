import uuid

import structlog

from polar.logging import Logger
from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import CustomerSeatRepository
from .service import seat_service

log: Logger = structlog.get_logger()


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
