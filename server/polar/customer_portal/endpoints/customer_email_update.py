import structlog
from fastapi import Depends

from polar.customer_email_update.schemas import (
    CustomerEmailUpdateRequest,
    CustomerEmailUpdateVerifyRequest,
    CustomerEmailUpdateVerifyResponse,
)
from polar.customer_email_update.service import (
    InvalidCustomerEmailUpdate,
)
from polar.customer_email_update.service import (
    customer_email_update as customer_email_update_service,
)
from polar.openapi import APITag
from polar.postgres import (
    AsyncReadSession,
    AsyncSession,
    get_db_read_session,
    get_db_session,
)
from polar.routing import APIRouter

from .. import auth
from ..utils import get_audit_context, get_customer

log = structlog.get_logger()

router = APIRouter(
    prefix="/customers/me/email-update", tags=["customers", APITag.public]
)


@router.post(
    "/request",
    summary="Request Email Change",
    status_code=202,
    responses={
        202: {"description": "Verification email sent."},
    },
)
async def request_email_update(
    body: CustomerEmailUpdateRequest,
    auth_subject: auth.CustomerPortalUnionBillingWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """Request an email change for the authenticated customer."""
    customer = get_customer(auth_subject)

    # Load organization for building the verification URL
    await session.refresh(customer, ["organization"])

    log.info(
        "customer_portal.email_update.request",
        new_email=body.email,
        **get_audit_context(auth_subject),
    )

    record, token = await customer_email_update_service.request_email_update(
        session, customer, body.email
    )
    await customer_email_update_service.send_verification_email(
        record, token, customer.organization
    )


# No auth required: the verification token serves as proof of email inbox
# access. Called from the server component before the page renders.
@router.get(
    "/check",
    summary="Check Email Change Token",
    status_code=204,
    responses={
        204: {"description": "Token is valid."},
        401: {"description": "Invalid or expired verification token."},
    },
)
async def check_email_update(
    token: str,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> None:
    """Check if an email change verification token is still valid."""
    valid = await customer_email_update_service.check_token(session, token)
    if not valid:
        raise InvalidCustomerEmailUpdate()


# No auth required: the verification token serves as proof of email inbox
# access. A new customer session is returned on success.
@router.post(
    "/verify",
    summary="Verify Email Change",
    response_model=CustomerEmailUpdateVerifyResponse,
    responses={
        200: {"description": "Email updated successfully."},
        401: {"description": "Invalid or expired verification token."},
        422: {"description": "Email address is already in use."},
    },
)
async def verify_email_update(
    body: CustomerEmailUpdateVerifyRequest,
    session: AsyncSession = Depends(get_db_session),
) -> CustomerEmailUpdateVerifyResponse:
    """Verify an email change using the token from the verification email."""
    customer, session_token = await customer_email_update_service.verify(
        session, body.token
    )

    log.info(
        "customer_portal.email_update.verified",
        customer_id=customer.id,
        new_email=customer.email,
    )

    return CustomerEmailUpdateVerifyResponse(token=session_token)
