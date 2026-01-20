from fastapi import Depends

from polar.models import CustomerSession, MemberSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from . import auth
from .schemas import CustomerSession as CustomerSessionSchema
from .schemas import CustomerSessionCreate
from .service import customer_session as customer_session_service

router = APIRouter(
    prefix="/customer-sessions",
    tags=["customer-sessions", APITag.public],
)


@router.post(
    "/",
    response_model=CustomerSessionSchema,
    status_code=201,
    summary="Create Customer Session",
    responses={201: {"description": "Customer session created."}},
)
async def create(
    customer_session_create: CustomerSessionCreate,
    auth_subject: auth.CustomerSessionWrite,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSession | MemberSession:
    """
    Create a customer session.

    For organizations with `member_model_enabled`, this will automatically
    create a member session for the owner member of the customer.
    """
    return await customer_session_service.create(
        session, auth_subject, customer_session_create
    )
