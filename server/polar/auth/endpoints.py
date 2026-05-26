from fastapi import Depends, Request, Response
from fastapi.responses import RedirectResponse
from reauth.authentication_session import (
    AuthenticationSession,
    FactorsRemainingException,
    IdentityNotAttachedException,
)
from reauth.factors.email_otp import ExpiredOTPException, InvalidOTPException
from reauth.factors.totp import (
    AlreadyEnabledTOTPException,
    AlreadyEnrolledTOTPException,
    InvalidTOTPCodeException,
    NotEnrolledTOTPException,
)

from polar.auth.exceptions import PolarAuthError, PolarAuthRedirectionError
from polar.auth.oauth2.github import get_github_factor
from polar.auth.oauth2.google import get_google_factor
from polar.authz.dependencies import AuthorizeWebUserWrite
from polar.exceptions import NotPermitted
from polar.models import UserSession as UserSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.repository import UserRepository
from polar.user.service import user as user_service

from .authentication_session import (
    AuthenticationSessionService,
    InvalidAuthenticationSession,
    get_authentication_session,
    get_authentication_session_service,
)
from .factors import (
    EmailOTPFactor,
    TOTPFactor,
    get_email_otp_factor,
    get_totp_factor,
)
from .oauth2.apple import get_apple_factor
from .oauth2.router import get_oauth_router
from .schemas import AuthenticationSession as AuthenticationSessionSchema
from .schemas import (
    AuthenticationSessionStart,
    EmailOTPRequest,
    EmailOTPVerify,
    TOTPEnable,
    TOTPEnrollment,
)
from .service import auth as auth_service

router = APIRouter(prefix="/auth", tags=["auth", APITag.private])
router.include_router(
    get_oauth_router(get_apple_factor, "apple", callback_method="POST")
)
router.include_router(get_oauth_router(get_github_factor, "github"))
router.include_router(get_oauth_router(get_google_factor, "google"))


@router.get("/logout")
async def logout(
    request: Request, session: AsyncSession = Depends(get_db_session)
) -> RedirectResponse:
    user_session = await auth_service.authenticate(session, request)
    return await auth_service.get_logout_response(session, request, user_session)


@router.post("/start", status_code=201)
async def start(
    authentication_session_start: AuthenticationSessionStart,
    request: Request,
    response: Response,
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
) -> AuthenticationSessionSchema:
    token, authentication_session = await authentication_session_service.start(
        return_to=authentication_session_start.return_to
    )
    await authentication_session_service.set_cookie(
        request, response, token, authentication_session.expires_at
    )
    return await authentication_session_service.to_schema(authentication_session)


@router.get(
    "/status",
    responses={
        401: {
            "description": "No active authentication session",
            "model": InvalidAuthenticationSession.schema(),
        }
    },
)
async def status(
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
) -> AuthenticationSessionSchema:
    return await authentication_session_service.to_schema(authentication_session)


@router.get("/complete")
async def complete(
    request: Request,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    try:
        identity_id, _ = await authentication_session_service.complete(
            authentication_session
        )
    except (IdentityNotAttachedException, FactorsRemainingException) as e:
        raise PolarAuthRedirectionError(
            "Authentication session cannot be completed"
        ) from e

    user_repository = UserRepository.from_session(session)
    user = await user_repository.get_by_id(identity_id)
    if user is None:
        raise PolarAuthRedirectionError("User not found for authenticated identity")

    return_to = (
        authentication_session.context.get("return_to")
        if authentication_session.context
        else None
    )

    response = await auth_service.get_login_response(
        session,
        request,
        user,
        return_to=return_to,
    )
    await authentication_session_service.set_cookie(request, response, "", 0)
    return response


@router.post("/email-otp/request", status_code=202)
async def email_otp_request(
    email_otp_request: EmailOTPRequest,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    email_otp_factor: EmailOTPFactor = Depends(get_email_otp_factor),
) -> None:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if email_otp_factor not in factors:
        raise PolarAuthError("Email OTP factor not available for this session")

    await email_otp_factor.request(email_otp_request, authentication_session)


@router.post(
    "/email-otp/verify",
    responses={
        403: {"description": "Invalid or expired OTP", "model": NotPermitted.schema()}
    },
)
async def email_otp_verify(
    email_otp_verify: EmailOTPVerify,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    email_otp_factor: EmailOTPFactor = Depends(get_email_otp_factor),
    session: AsyncSession = Depends(get_db_session),
) -> AuthenticationSessionSchema:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if email_otp_factor not in factors:
        raise PolarAuthError("Email OTP factor not available for this session")

    try:
        identity_id, email = await email_otp_factor.consume(
            email_otp_verify.code, authentication_session.id
        )
    except (InvalidOTPException, ExpiredOTPException) as e:
        raise PolarAuthError("Invalid or expired OTP") from e

    # New user
    if identity_id is None:
        user, _ = await user_service.get_by_email_or_create(session, email)
        user.email_verified = True
        session.add(user)
        identity_id = user.id

    authentication_session = await authentication_session_service.advance(
        authentication_session, identity_id, email_otp_factor
    )
    return await authentication_session_service.to_schema(authentication_session)


@router.post("/totp/enroll", status_code=201)
async def totp_enroll(
    auth_subject: AuthorizeWebUserWrite,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> TOTPEnrollment:
    user = auth_subject.subject

    try:
        enrollment = await totp_factor.enroll(user.id)
    except AlreadyEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor already enrolled", status_code=409) from e

    return TOTPEnrollment(
        secret=enrollment.secret,
        algorithm=enrollment.algorithm,
        digits=enrollment.code_length,
        period=enrollment.time_step,
        provisioning_uri=enrollment.get_provisioning_uri(user.email, "Polar"),
    )


@router.post("/totp/enable", status_code=202)
async def totp_enable(
    enable: TOTPEnable,
    auth_subject: AuthorizeWebUserWrite,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> None:
    user = auth_subject.subject
    try:
        await totp_factor.enable(user.id, enable.code)
    except NotEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor not enrolled") from e
    except AlreadyEnabledTOTPException as e:
        raise PolarAuthError("TOTP factor already enabled") from e
    except InvalidTOTPCodeException as e:
        raise PolarAuthError("Invalid TOTP code") from e
    return None


@router.post("/totp/verify")
async def totp_verify(
    enable: TOTPEnable,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> AuthenticationSessionSchema:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if totp_factor not in factors:
        raise PolarAuthError("TOTP factor not available for this session")

    try:
        await totp_factor.verify(authentication_session.identity_id, enable.code)
    except NotEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor not enrolled") from e
    except InvalidTOTPCodeException as e:
        raise PolarAuthError("Invalid TOTP code") from e

    authentication_session = await authentication_session_service.advance(
        authentication_session, authentication_session.identity_id, totp_factor
    )
    return await authentication_session_service.to_schema(authentication_session)
