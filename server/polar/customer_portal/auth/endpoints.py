from fastapi import Depends, Request, Response
from fastapi.responses import JSONResponse
from reauth.authentication_session import AuthenticationSession
from reauth.factors.email_otp import ExpiredOTPException, InvalidOTPException
from sqlalchemy.orm import joinedload

from polar.auth.authentication_session import InvalidAuthenticationSession
from polar.auth.exceptions import UnavailableFactorError
from polar.auth.turnstile import verify_turnstile
from polar.customer.repository import CustomerRepository
from polar.exceptions import NotPermitted
from polar.kit.http import get_ip_address
from polar.member.repository import MemberRepository
from polar.member_session.service import member_session as member_session_service
from polar.models import Member
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter

from ..schemas.customer_session import (
    CustomerSelectionOption,
    CustomerSelectionRequiredResponse,
    CustomerSessionAuthenticationStart,
    CustomerSessionCodeAuthenticateResponse,
    CustomerSessionEmailOTPRequest,
    CustomerSessionEmailOTPVerify,
)
from ..service.customer_session import (
    CustomerDoesNotExist,
    CustomerSelectionRequired,
    CustomerSessionCodeInvalidOrExpired,
    OrganizationDoesNotExist,
)
from .authentication_session import (
    CustomerSessionAuthenticationSessionService,
    get_authentication_session,
    get_authentication_session_service,
)
from .factors import CustomerSessionEmailOTPFactor, get_email_otp_factor

router = APIRouter(prefix="/customer-session", tags=["customer-session"])


@router.post(
    "/start",
    name="customer_portal.customer_session.start",
    status_code=201,
    response_model=None,
    tags=[APITag.private],
)
async def start(
    authentication_start: CustomerSessionAuthenticationStart,
    request: Request,
    response: Response,
    authentication_session_service: CustomerSessionAuthenticationSessionService = (
        Depends(get_authentication_session_service)
    ),
) -> None:
    token, authentication_session = await authentication_session_service.start(
        organization_id=str(authentication_start.organization_id)
    )
    await authentication_session_service.set_cookie(
        request, response, token, authentication_session.expires_at
    )


@router.post(
    "/email-otp/request",
    name="customer_portal.customer_session.email_otp_request",
    status_code=202,
    response_model=None,
    tags=[APITag.private],
    responses={
        403: {
            "description": "Turnstile verification failed",
            "model": NotPermitted.schema(),
        },
        409: {
            "description": "Multiple customers found for this email.",
            "model": CustomerSelectionRequiredResponse,
        },
    },
)
async def email_otp_request(
    email_otp_request: CustomerSessionEmailOTPRequest,
    request: Request,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: CustomerSessionAuthenticationSessionService = (
        Depends(get_authentication_session_service)
    ),
    email_otp_factor: CustomerSessionEmailOTPFactor = Depends(get_email_otp_factor),
) -> Response | None:
    await verify_turnstile(email_otp_request.turnstile_token, get_ip_address(request))

    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if email_otp_factor not in factors:
        raise UnavailableFactorError(email_otp_factor.identifier)

    try:
        await email_otp_factor.request(
            email_otp_request.email,
            email_otp_request.customer_id,
            authentication_session,
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
    except CustomerDoesNotExist, OrganizationDoesNotExist:
        # We don't want to leak information about whether the customer or organization exists
        return None
    return None


@router.post(
    "/email-otp/verify",
    name="customer_portal.customer_session.email_otp_verify",
    responses={
        401: {
            "description": (
                "Invalid or expired verification code, "
                "or invalid authentication session."
            ),
            "model": CustomerSessionCodeInvalidOrExpired.schema()
            | InvalidAuthenticationSession.schema(),
        }
    },
    tags=[APITag.private],
)
async def email_otp_verify(
    email_otp_verify: CustomerSessionEmailOTPVerify,
    request: Request,
    response: Response,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: CustomerSessionAuthenticationSessionService = (
        Depends(get_authentication_session_service)
    ),
    email_otp_factor: CustomerSessionEmailOTPFactor = Depends(get_email_otp_factor),
    session: AsyncSession = Depends(get_db_session),
) -> CustomerSessionCodeAuthenticateResponse:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if email_otp_factor not in factors:
        raise UnavailableFactorError(email_otp_factor.identifier)

    try:
        identity_id, email = await email_otp_factor.consume(
            email_otp_verify.code, authentication_session.id
        )
    except (InvalidOTPException, ExpiredOTPException) as e:
        raise CustomerSessionCodeInvalidOrExpired() from e

    authentication_session = await authentication_session_service.advance(
        authentication_session, identity_id, email_otp_factor
    )
    identity_id, _ = await authentication_session_service.complete(
        authentication_session
    )

    member_repository = MemberRepository.from_session(session)
    member = await member_repository.get_by_id(
        identity_id, options=(joinedload(Member.customer),)
    )
    if member is None:
        raise CustomerSessionCodeInvalidOrExpired()

    customer = member.customer
    if customer.email is not None and email.lower() == customer.email.lower():
        customer_repository = CustomerRepository.from_session(session)
        await customer_repository.update(customer, update_dict={"email_verified": True})

    token, _ = await member_session_service.create_member_session(session, member)
    await authentication_session_service.set_cookie(request, response, "", 0)
    return CustomerSessionCodeAuthenticateResponse(token=token)
