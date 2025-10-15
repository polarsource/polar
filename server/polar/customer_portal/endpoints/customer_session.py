from fastapi import Depends

from polar.kit.db.postgres import AsyncSession
from polar.models import CustomerSession
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer_session import (
    CustomerCustomerSession,
    CustomerSessionCodeAuthenticateRequest,
    CustomerSessionCodeAuthenticateResponse,
    CustomerSessionCodeInvalidOrExpiredResponse,
    CustomerSessionCodeRequest,
)
from ..service.customer_session import (
    CustomerDoesNotExist,
    OrganizationDoesNotExist,
)
from ..service.customer_session import customer_session as customer_session_service

router = APIRouter(prefix="/customer-session", tags=["customer-session"])


@router.post(
    "/request",
    name="customer_portal.customer_session.request",
    status_code=202,
    tags=[APITag.private],
)
async def request(
    customer_session_code_request: CustomerSessionCodeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    try:
        customer_session_code, code = await customer_session_service.request(
            session,
            customer_session_code_request.email,
            customer_session_code_request.organization_id,
        )
    except (CustomerDoesNotExist, OrganizationDoesNotExist):
        # We don't want to leak information about whether the customer or organization exists
        return

    await customer_session_service.send(
        session,
        customer_session_code,
        code,
    )


@router.post(
    "/authenticate",
    name="customer_portal.customer_session.authenticate",
    responses={
        401: CustomerSessionCodeInvalidOrExpiredResponse,
    },
    tags=[APITag.private],
)
async def authenticate(
    authenticated_request: CustomerSessionCodeAuthenticateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSessionCodeAuthenticateResponse:
    token, _ = await customer_session_service.authenticate(
        session, authenticated_request.code
    )
    return CustomerSessionCodeAuthenticateResponse(token=token)


@router.get(
    "/introspect",
    summary="Introspect Customer Session",
    tags=[APITag.public],
    response_model=CustomerCustomerSession,
)
async def introspect(
    auth_subject: auth.CustomerPortalRead,
) -> CustomerSession:
    """Introspect the current session and return its information."""
    session = auth_subject.session
    assert isinstance(session, CustomerSession)
    return session
