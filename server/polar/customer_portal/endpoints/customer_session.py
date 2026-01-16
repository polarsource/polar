from fastapi import Depends, Response
from fastapi.responses import JSONResponse

from polar.auth.models import is_customer, is_member
from polar.kit.db.postgres import AsyncSession
from polar.models import CustomerSession, MemberSession
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer_session import (
    CustomerCustomerSession,
    CustomerSelectionOption,
    CustomerSelectionRequiredResponse,
    CustomerSessionCodeAuthenticateRequest,
    CustomerSessionCodeAuthenticateResponse,
    CustomerSessionCodeInvalidOrExpiredResponse,
    CustomerSessionCodeRequest,
    PortalAuthenticatedUser,
)
from ..service.customer_session import (
    CustomerDoesNotExist,
    CustomerSelectionRequired,
    OrganizationDoesNotExist,
)
from ..service.customer_session import customer_session as customer_session_service

router = APIRouter(prefix="/customer-session", tags=["customer-session"])


@router.post(
    "/request",
    name="customer_portal.customer_session.request",
    status_code=202,
    response_model=None,
    tags=[APITag.private],
    responses={
        409: {
            "description": "Multiple customers found for this email.",
            "model": CustomerSelectionRequiredResponse,
        },
    },
)
async def request(
    customer_session_code_request: CustomerSessionCodeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> Response | None:
    try:
        customer_session_code, code = await customer_session_service.request(
            session,
            customer_session_code_request.email,
            customer_session_code_request.organization_id,
            customer_session_code_request.customer_id,
        )
    except CustomerSelectionRequired as e:
        return JSONResponse(
            status_code=409,
            content=CustomerSelectionRequiredResponse(
                customers=[
                    CustomerSelectionOption(id=c.id, name=c.name) for c in e.customers
                ],
            ).model_dump(mode="json"),
        )
    except (CustomerDoesNotExist, OrganizationDoesNotExist):
        # We don't want to leak information about whether the customer or organization exists
        return None

    await customer_session_service.send(
        session,
        customer_session_code,
        code,
    )
    return None


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
    auth_subject: auth.CustomerPortalUnionRead,
) -> CustomerSession | MemberSession:
    """Introspect the current session and return its information."""
    session = auth_subject.session
    assert isinstance(session, (CustomerSession, MemberSession))
    return session


@router.get(
    "/user",
    summary="Get Authenticated Portal User",
    tags=[APITag.public],
    response_model=PortalAuthenticatedUser,
)
async def get_authenticated_user(
    auth_subject: auth.CustomerPortalUnionRead,
) -> PortalAuthenticatedUser:
    """Get information about the currently authenticated portal user."""
    if is_member(auth_subject):
        member = auth_subject.subject
        return PortalAuthenticatedUser(
            type="member",
            name=member.name,
            email=member.email,
            customer_id=member.customer_id,
            role=member.role,
        )
    elif is_customer(auth_subject):
        customer = auth_subject.subject
        return PortalAuthenticatedUser(
            type="customer",
            name=customer.name,
            email=customer.email,
            customer_id=customer.id,
            role=None,
        )
    raise ValueError("Invalid auth subject type")
