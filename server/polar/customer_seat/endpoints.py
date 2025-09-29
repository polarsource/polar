from fastapi import Depends

from polar.customer.auth import CustomerRead
from polar.exceptions import ResourceNotFound
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from .schemas import CustomerSeat as CustomerSeatSchema
from .schemas import SeatClaim

router = APIRouter(
    prefix="/seats",
    tags=["seats", APITag.private],
)


@router.post(
    "/claim",
    summary="Claim Seat",
    response_model=CustomerSeatSchema,
    responses={
        400: {"description": "Invalid or expired invitation token"},
        403: {"description": "Seat-based pricing not enabled for organization"},
        404: {"description": "Customer not found"},
    },
)
async def claim_seat(
    seat_claim: SeatClaim,
    auth_subject: CustomerRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSeatSchema:
    if not hasattr(auth_subject.subject, "id"):
        raise ResourceNotFound()
    raise NotImplementedError(
        "Seat claiming endpoint needs customer authentication implementation"
    )
