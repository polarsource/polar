import typing
from uuid import UUID

from fastapi import Depends, Request, Response
from fastapi.responses import RedirectResponse
from reauth.authentication_session import (
    AuthenticationSession,
    FactorsRemainingException,
    IdentityNotAttachedException,
)
from reauth.factors.backup_codes import (
    AlreadyUsedBackupCodeException,
    InvalidBackupCodeException,
)
from reauth.factors.email_otp import ExpiredOTPException, InvalidOTPException
from reauth.factors.totp import (
    AlreadyEnabledTOTPException,
    AlreadyEnrolledTOTPException,
    InvalidTOTPCodeException,
    NotEnrolledTOTPException,
)

from polar.auth.exceptions import (
    PolarAuthError,
    PolarAuthRedirectionError,
    SessionNotFreshError,
    UnavailableFactorError,
)
from polar.auth.oauth2.github import get_github_factor
from polar.auth.oauth2.google import get_google_factor
from polar.authz.dependencies import (
    AuthorizeWebUserRead,
    AuthorizeWebUserWrite,
    AuthorizeWebUserWriteFresh,
    is_step_up_allowed,
)
from polar.exceptions import NotPermitted, ResourceNotFound
from polar.kit.utils import utc_now
from polar.models import UserSession as UserSession
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session
from polar.routing import APIRouter
from polar.user.repository import UserRepository
from polar.user.service import user as user_service
from polar.user_organization.repository import UserOrganizationRepository

from .authentication_session import (
    AuthenticationSessionService,
    InvalidAuthenticationSession,
    get_authentication_session,
    get_authentication_session_service,
)
from .factors import (
    BackupCodesFactor,
    EmailOTPFactor,
    TOTPFactor,
    get_backup_codes_factor,
    get_email_otp_factor,
    get_totp_factor,
)
from .oauth2.apple import get_apple_factor
from .oauth2.router import get_oauth_link_router, get_oauth_login_router
from .schemas import AuthenticationSession as AuthenticationSessionSchema
from .schemas import (
    AuthenticationSessionStart,
    BackupCodesEnrollment,
    BackupCodesStatus,
    BackupCodesVerify,
    EmailOTPRequest,
    EmailOTPVerify,
    LoginMethod,
    TOTPEnable,
    TOTPEnrollment,
    TOTPStatus,
)
from .service import auth as auth_service
from .sso.endpoints import router as sso_login_router

STEP_UP_SESSION_CONTEXT_KEY = "step_up_user_session_id"

router = APIRouter(prefix="/auth", tags=["auth", APITag.private])
router.include_router(
    get_oauth_login_router(get_apple_factor, "apple", callback_method="POST")
)
router.include_router(get_oauth_login_router(get_github_factor, "github"))
router.include_router(get_oauth_link_router(get_github_factor, "github"))
router.include_router(get_oauth_login_router(get_google_factor, "google"))
router.include_router(get_oauth_link_router(get_google_factor, "google"))
router.include_router(sso_login_router)


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


@router.get("/complete", include_in_schema=False)
async def complete(
    request: Request,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if (authentication_session.context or {}).get(
        STEP_UP_SESSION_CONTEXT_KEY
    ) is not None:
        raise PolarAuthRedirectionError("Authentication session cannot be completed")

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

    context = authentication_session.context or {}

    # An SSO-authenticated session stays scoped to its organization, whichever
    # completion path (including the global 2FA pages) it reaches.
    organization_ids: frozenset[UUID] | None = None
    factor: LoginMethod
    sso_organization_id = context.get("sso_organization_id")
    if sso_organization_id is not None:
        organization_id = UUID(sso_organization_id)
        user_organization_repository = UserOrganizationRepository.from_session(session)
        membership = await user_organization_repository.get_by_user_and_organization(
            user.id, organization_id
        )
        if membership is None:
            raise PolarAuthRedirectionError("You are not a member of this organization")
        organization_ids = frozenset({organization_id})
        factor = "sso"
    else:
        factor = typing.cast(LoginMethod, authentication_session.used_factors[0])

    response = await auth_service.get_login_response(
        session,
        request,
        user,
        return_to=context.get("return_to"),
        factor=factor,
        organization_ids=organization_ids,
    )
    await authentication_session_service.set_cookie(request, response, "", 0)
    return response


@router.post(
    "/step-up",
    status_code=201,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def step_up_start(
    request: Request,
    response: Response,
    auth_subject: AuthorizeWebUserWrite,
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
) -> AuthenticationSessionSchema:
    assert isinstance(auth_subject.session, UserSession)
    if not is_step_up_allowed(auth_subject):
        raise SessionNotFreshError()

    token, authentication_session = await authentication_session_service.start(
        **{STEP_UP_SESSION_CONTEXT_KEY: str(auth_subject.session.id)}
    )
    authentication_session.identity_id = auth_subject.subject.id
    authentication_session.step = 1
    await authentication_session_service.update(authentication_session)

    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if not factors:
        await authentication_session_service.delete(authentication_session)
        raise SessionNotFreshError()

    await authentication_session_service.set_cookie(
        request, response, token, authentication_session.expires_at
    )
    return await authentication_session_service.to_schema(authentication_session)


@router.post(
    "/step-up/complete",
    status_code=204,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def step_up_complete(
    request: Request,
    response: Response,
    auth_subject: AuthorizeWebUserWrite,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
) -> None:
    assert isinstance(auth_subject.session, UserSession)
    context = authentication_session.context or {}
    if (
        context.get(STEP_UP_SESSION_CONTEXT_KEY) != str(auth_subject.session.id)
        or authentication_session.identity_id != auth_subject.subject.id
        or not authentication_session.amr
    ):
        raise NotPermitted()
    if not is_step_up_allowed(auth_subject):
        raise SessionNotFreshError()

    try:
        await authentication_session_service.complete(authentication_session)
    except FactorsRemainingException as e:
        raise NotPermitted() from e

    auth_subject.session.last_authenticated_at = utc_now()
    await authentication_session_service.set_cookie(request, response, "", 0)


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
        raise UnavailableFactorError(email_otp_factor.identifier)

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
        raise UnavailableFactorError(email_otp_factor.identifier)

    try:
        identity_id, email = await email_otp_factor.consume(
            email_otp_verify.code, authentication_session.id
        )
    except (InvalidOTPException, ExpiredOTPException) as e:
        raise PolarAuthError("Invalid or expired OTP", 403) from e

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


@router.get("/totp", responses={404: {"description": "TOTP factor not enrolled"}})
async def totp_status(
    auth_subject: AuthorizeWebUserRead,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> TOTPStatus:
    user = auth_subject.subject
    enrollment = await totp_factor.get_enrollment(user.id)
    if enrollment is None:
        raise ResourceNotFound()
    return TOTPStatus(enabled=enrollment.enabled)


@router.post(
    "/totp",
    status_code=201,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def totp_enroll(
    auth_subject: AuthorizeWebUserWriteFresh,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> TOTPEnrollment:
    user = auth_subject.subject

    try:
        enrollment = await totp_factor.enroll(user.id)
    except AlreadyEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor already enrolled", 409) from e

    return TOTPEnrollment(
        secret=enrollment.secret,
        algorithm=enrollment.algorithm,
        digits=enrollment.code_length,
        period=enrollment.time_step,
        provisioning_uri=enrollment.get_provisioning_uri(user.email, "Polar"),
    )


@router.post(
    "/totp/enable",
    status_code=202,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def totp_enable(
    enable: TOTPEnable,
    auth_subject: AuthorizeWebUserWriteFresh,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
) -> None:
    user = auth_subject.subject
    try:
        await totp_factor.enable(user.id, enable.code)
    except NotEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor not enrolled", 403) from e
    except AlreadyEnabledTOTPException as e:
        raise PolarAuthError("TOTP factor already enabled", 409) from e
    except InvalidTOTPCodeException as e:
        raise PolarAuthError("Invalid TOTP code", 403) from e
    return None


@router.delete(
    "/totp",
    status_code=204,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def totp_delete(
    auth_subject: AuthorizeWebUserWriteFresh,
    totp_factor: TOTPFactor = Depends(get_totp_factor),
    backup_codes_factor: BackupCodesFactor = Depends(get_backup_codes_factor),
) -> None:
    user = auth_subject.subject
    enrollment = await totp_factor.get_by_identity_id(user.id)
    if enrollment is None:
        raise ResourceNotFound()
    await totp_factor.delete(enrollment)

    # Disable backup codes as well since they are meant to be used as a backup for TOTP
    backup_codes_enrollment = await backup_codes_factor.get_enrollment(user.id)
    if backup_codes_enrollment is not None:
        await backup_codes_factor.delete(backup_codes_enrollment)

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
        raise UnavailableFactorError(totp_factor.identifier)

    try:
        await totp_factor.verify(authentication_session.identity_id, enable.code)
    except NotEnrolledTOTPException as e:
        raise PolarAuthError("TOTP factor not enrolled", 403) from e
    except InvalidTOTPCodeException as e:
        raise PolarAuthError("Invalid TOTP code", 403) from e

    authentication_session = await authentication_session_service.advance(
        authentication_session, authentication_session.identity_id, totp_factor
    )
    return await authentication_session_service.to_schema(authentication_session)


@router.get(
    "/backup-codes",
    responses={404: {"description": "Backup codes factor not enrolled"}},
)
async def backup_codes_status(
    auth_subject: AuthorizeWebUserRead,
    backup_codes_factor: BackupCodesFactor = Depends(get_backup_codes_factor),
) -> BackupCodesStatus:
    user = auth_subject.subject
    enrollment = await backup_codes_factor.get_enrollment(user.id)
    if enrollment is None:
        raise ResourceNotFound()
    return BackupCodesStatus(
        codes=len(enrollment.codes_hashes), used_codes=len(enrollment.used_codes_hashes)
    )


@router.post(
    "/backup-codes",
    status_code=201,
    responses={403: {"model": SessionNotFreshError.schema()}},
)
async def backup_codes_enroll(
    auth_subject: AuthorizeWebUserWriteFresh,
    backup_codes_factor: BackupCodesFactor = Depends(get_backup_codes_factor),
) -> BackupCodesEnrollment:
    user = auth_subject.subject
    codes, _ = await backup_codes_factor.enroll(user.id)
    return BackupCodesEnrollment(codes=codes)


@router.post("/backup-codes/verify")
async def backup_codes_verify(
    verify: BackupCodesVerify,
    authentication_session: AuthenticationSession = Depends(get_authentication_session),
    authentication_session_service: AuthenticationSessionService = Depends(
        get_authentication_session_service
    ),
    backup_codes_factor: BackupCodesFactor = Depends(get_backup_codes_factor),
) -> AuthenticationSessionSchema:
    factors = await authentication_session_service.get_available_factors(
        authentication_session
    )
    if backup_codes_factor not in factors:
        raise UnavailableFactorError(backup_codes_factor.identifier)

    try:
        await backup_codes_factor.verify(
            authentication_session.identity_id, verify.code
        )
    except (InvalidBackupCodeException, AlreadyUsedBackupCodeException) as e:
        raise PolarAuthError("Invalid or expired backup code", 400) from e

    authentication_session = await authentication_session_service.advance(
        authentication_session, authentication_session.identity_id, backup_codes_factor
    )
    return await authentication_session_service.to_schema(authentication_session)
