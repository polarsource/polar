from polar.auth.models import is_customer, is_member
from polar.exceptions import PolarRequestValidationError
from polar.models import CustomerSession, MemberSession
from polar.openapi import APITag
from polar.routing import APIRouter

from .. import auth
from ..schemas.customer_session import (
    CustomerCustomerSession,
    PortalAuthenticatedUser,
)

router = APIRouter(prefix="/customer-session", tags=["customer-session"])


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
            member_id=member.id,
            role=member.role,
        )
    elif is_customer(auth_subject):
        customer = auth_subject.subject
        if customer.email is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body",),
                        "msg": "Team customers must use member sessions. Create a customer session via the API with a member_id.",
                        "type": "value_error",
                        "input": None,
                    }
                ]
            )
        return PortalAuthenticatedUser(
            type="customer",
            name=customer.name,
            email=customer.email,
            customer_id=customer.id,
            role=None,
        )
    raise ValueError("Invalid auth subject type")
