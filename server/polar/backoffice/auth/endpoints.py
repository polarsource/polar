import secrets
from urllib.parse import urlsplit

import httpx
from fastapi import Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from reauth.authentication_session import AuthenticationSessionException
from reauth.exceptions import ReauthException

from polar.config import settings
from polar.openapi import APITag
from polar.postgres import AsyncSession, get_db_session

from ..routing import BackofficeRouter
from .factor import (
    BackofficeGoogleFactor,
    BackofficeOAuth2StateService,
    get_backoffice_oauth2_state_service,
    get_google_factor,
    google_factor,
)
from .repository import (
    BackofficeAuthenticationSessionRepository,
    BackofficeUserRepository,
    BackofficeUserSessionRepository,
)
from .service import (
    AUTHENTICATION_TOKEN_PREFIX,
    BackofficeAuthenticationSessionService,
    create_user_session,
    get_user_session,
    get_user_session_token,
    set_cookie,
)

router = BackofficeRouter(prefix="/auth", tags=[APITag.private])


@router.get("/", name="backoffice:auth")
async def index(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
    state_service: BackofficeOAuth2StateService = Depends(
        get_backoffice_oauth2_state_service
    ),
) -> RedirectResponse:
    if await get_user_session(request, session) is not None:
        return RedirectResponse(settings.generate_backoffice_url("/"), status_code=303)

    async with google_factor(state_service) as factor:
        authentication = BackofficeAuthenticationSessionService(
            BackofficeAuthenticationSessionRepository.from_session(session), factor
        )
        token, auth_session = await authentication.start()
        try:
            url, _, _ = await factor.start(
                redirect_uri=settings.generate_backoffice_url("/auth/callback"),
                scope=["openid", "email"],
                nonce=secrets.token_urlsafe(32),
                code_challenge_method="S256",
                authentication_session_token_hash=auth_session.token_hash,
            )
        except (ReauthException, httpx.HTTPError) as e:
            raise HTTPException(502, "Google sign-in is unavailable") from e

    response = RedirectResponse(url, status_code=303)
    set_cookie(
        request,
        response,
        settings.BACKOFFICE_AUTHENTICATION_SESSION_COOKIE_KEY,
        token,
        int(settings.BACKOFFICE_AUTHENTICATION_SESSION_TTL.total_seconds()),
    )
    return response


@router.get("/callback", name="backoffice:auth_callback")
async def callback(
    request: Request,
    state: str,
    code: str | None = None,
    error: str | None = None,
    session: AsyncSession = Depends(get_db_session),
    state_service: BackofficeOAuth2StateService = Depends(
        get_backoffice_oauth2_state_service
    ),
    factor: BackofficeGoogleFactor = Depends(get_google_factor),
) -> RedirectResponse:
    token = request.cookies.get(
        settings.BACKOFFICE_AUTHENTICATION_SESSION_COOKIE_KEY, ""
    )
    if not token.startswith(AUTHENTICATION_TOKEN_PREFIX) or not token.isascii():
        raise HTTPException(401, "Invalid backoffice authentication session")

    authentication = BackofficeAuthenticationSessionService(
        BackofficeAuthenticationSessionRepository.from_session(session), factor
    )
    try:
        auth_session = await authentication.validate(token)
    except AuthenticationSessionException as e:
        raise HTTPException(401, "Invalid backoffice authentication session") from e

    oauth_state = await state_service.get_by_token(state)
    if (
        oauth_state is None
        or oauth_state.provider != factor.identifier
        or (oauth_state.context or {}).get("authentication_session_token_hash")
        != auth_session.token_hash
    ):
        raise HTTPException(401, "Invalid backoffice OAuth state")

    try:
        _, account, _ = await factor.callback(code=code, state=state, error=error)
        if account is None or account.id_token is None:
            raise HTTPException(401, "Google sign-in failed")
        claims = await factor.get_id_token_claims(account.id_token)
    except (ReauthException, httpx.HTTPError) as e:
        raise HTTPException(401, "Google sign-in failed") from e
    email = claims.get("email")
    subject = claims.get("sub")
    if (
        claims.get("hd") != settings.BACKOFFICE_GOOGLE_HOSTED_DOMAIN.strip().lower()
        or claims.get("email_verified") is not True
        or not isinstance(email, str)
        or not isinstance(subject, str)
    ):
        raise HTTPException(403, "Google account is not eligible for backoffice access")

    user = await BackofficeUserRepository.from_session(session).provision(
        subject, email
    )
    if user is None:
        raise HTTPException(403, "Backoffice account is disabled")

    await authentication.advance(auth_session, user.id, factor)
    await authentication.complete(auth_session)
    old_token = get_user_session_token(request)
    if old_token is not None:
        await BackofficeUserSessionRepository.from_session(session).revoke(old_token)
    user_token = await create_user_session(session, user)

    response = RedirectResponse(settings.generate_backoffice_url("/"), status_code=303)
    set_cookie(
        request, response, settings.BACKOFFICE_AUTHENTICATION_SESSION_COOKIE_KEY, "", 0
    )
    set_cookie(
        request,
        response,
        settings.BACKOFFICE_USER_SESSION_COOKIE_KEY,
        user_token,
        int(settings.BACKOFFICE_USER_SESSION_TTL.total_seconds()),
    )
    return response


@router.get("/logout", name="backoffice:logout")
async def logout(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    url = urlsplit(settings.generate_backoffice_url("/auth/"))
    if (
        request.headers.get("sec-fetch-site") not in {"same-origin", "none"}
        and request.headers.get("origin") != f"{url.scheme}://{url.netloc}"
    ):
        raise HTTPException(403, "Invalid logout origin")

    token = get_user_session_token(request)
    if token is not None:
        await BackofficeUserSessionRepository.from_session(session).revoke(token)
    response = RedirectResponse(url.geturl(), status_code=303)
    set_cookie(request, response, settings.BACKOFFICE_USER_SESSION_COOKIE_KEY, "", 0)
    return response
