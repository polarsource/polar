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
    CustomerSessionCustomersResponse,
    CustomerSessionSelectRequest,
    CustomerSessionSelectResponse,
    CustomerSessionSwitchRequest,
    CustomerSessionSwitchResponse,
    CustomerSummary,
)
from ..service.customer_session import (
    AuthenticateSuccess,
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
    result = await customer_session_service.authenticate(
        session, authenticated_request.code
    )

    if isinstance(result, AuthenticateSuccess):
        return CustomerSessionCodeAuthenticateResponse(
            token=result.token,
            customer_id=result.customer_session.customer_id,
            member_id=result.customer_session.member_id,
        )

    # CustomerSelectionRequired - member belongs to multiple customers
    return CustomerSessionCodeAuthenticateResponse(
        requires_customer_selection=True,
        selection_token=result.selection_token,
        email=result.email,
        organization_id=result.organization_id,
        available_customers=[
            CustomerSummary(
                id=customer.id,
                name=customer.name,
                email=customer.email,
            )
            for customer in result.customers
        ],
    )


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
    customer_session = auth_subject.session
    assert isinstance(customer_session, CustomerSession)
    return customer_session


@router.post(
    "/select",
    name="customer_portal.customer_session.select",
    summary="Select Customer",
    tags=[APITag.private],
)
async def select(
    select_request: CustomerSessionSelectRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSessionSelectResponse:
    """
    Complete authentication by selecting a customer.

    Called after authenticate returns requires_customer_selection=true.
    The selection_token, email, and organization_id come from the
    authenticate response and must be passed back here.
    """
    token, customer_session = await customer_session_service.select_customer(
        session,
        selection_token=select_request.selection_token,
        customer_id=select_request.customer_id,
        email=select_request.email,
        organization_id=select_request.organization_id,
    )
    return CustomerSessionSelectResponse(
        token=token,
        customer_id=customer_session.customer_id,
        member_id=customer_session.member_id,  # type: ignore[arg-type]
    )


@router.post(
    "/switch",
    name="customer_portal.customer_session.switch",
    summary="Switch Customer",
    tags=[APITag.private],
)
async def switch(
    switch_request: CustomerSessionSwitchRequest,
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSessionSwitchResponse:
    """
    Switch to a different customer within the same member's access.

    Requires an active session with member authentication.
    Returns a new session token for the target customer.
    """
    current_session = auth_subject.session
    assert isinstance(current_session, CustomerSession)

    token, customer_session = await customer_session_service.switch_customer(
        session,
        current_session=current_session,
        customer_id=switch_request.customer_id,
    )
    return CustomerSessionSwitchResponse(
        token=token,
        customer_id=customer_session.customer_id,
        member_id=customer_session.member_id,  # type: ignore[arg-type]
    )


@router.get(
    "/customers",
    name="customer_portal.customer_session.customers",
    summary="List Available Customers",
    tags=[APITag.private],
)
async def list_customers(
    auth_subject: auth.CustomerPortalRead,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSessionCustomersResponse:
    """
    List all customers the current member can access.

    Used to populate the customer switcher in the navigation.
    """
    current_session = auth_subject.session
    assert isinstance(current_session, CustomerSession)

    customers = await customer_session_service.list_available_customers(
        session, current_session
    )
    return CustomerSessionCustomersResponse(
        current_customer_id=current_session.customer_id,
        customers=[
            CustomerSummary(
                id=customer.id,
                name=customer.name,
                email=customer.email,
            )
            for customer in customers
        ],
    )
