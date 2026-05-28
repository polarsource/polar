import secrets
import typing
from collections.abc import Awaitable, Iterable

from fastapi import APIRouter, Depends, Form, Query, Request, Response
from fastapi.responses import RedirectResponse
from reauth.authentication_session import AuthenticationSession
from reauth.factors import FactorBase
from reauth.factors.oauth2.base import (
    OAuth2CallbackException,
    OAuth2Factor,
    OAuth2IdentityMismatchException,
    OAuth2TokenException,
)

from polar.authz.dependencies import AuthorizeWebUserWrite
from polar.config import settings
from polar.kit.http import ReturnTo, is_localhost
from polar.user.service import user as user_service

from ..authentication_session import (
    AuthenticationSessionService,
    get_authentication_session,
    get_authentication_session_service,
    get_optional_authentication_session,
)
from ..exceptions import GetEmailError, PolarAuthRedirectionError
from .factor import OAuth2FactorMixin


def _set_state_cookie(
    request: Request, response: Response, state: str, expires_at: int
) -> None:
    response.set_cookie(
        settings.OAUTH2_SESSION_STATE_COOKIE_KEY,
        state,
        path="/",
        httponly=True,
        secure=not is_localhost(request),
        samesite="lax",
        expires=expires_at,
    )


def _check_factor(
    factor: FactorBase[typing.Any], available_factors: Iterable[FactorBase[typing.Any]]
) -> None:
    for available_factor in available_factors:
        if available_factor.identifier == factor.identifier:
            return
    raise PolarAuthRedirectionError("Factor not available for this session")


def get_oauth_login_router(
    factor_dependency: typing.Callable[..., Awaitable[OAuth2Factor[typing.Any]]],
    identifier: str,
    *,
    callback_method: typing.Literal["GET", "POST"] = "GET",
) -> APIRouter:
    router = APIRouter(prefix=f"/{identifier}", include_in_schema=False)

    @router.get("/authorize", name=f"auth.{identifier}.authorize")
    async def _authorize(
        request: Request,
        authentication_session: AuthenticationSession = Depends(
            get_authentication_session
        ),
        authentication_session_service: AuthenticationSessionService = Depends(
            get_authentication_session_service
        ),
        factor: OAuth2Factor[typing.Any] = Depends(factor_dependency),
    ) -> RedirectResponse:
        factors = await authentication_session_service.get_available_factors(
            authentication_session
        )
        _check_factor(factor, factors)

        redirect_uri = str(request.url_for(f"auth.{identifier}.callback"))

        authorization_url, state, oauth2_state = await factor.start(
            redirect_uri=redirect_uri,
            scope=typing.cast(OAuth2FactorMixin, factor).SCOPE,
            nonce=secrets.token_urlsafe(16),
            authentication_session_token_hash=authentication_session.token_hash,
        )

        response = RedirectResponse(authorization_url, status_code=303)
        _set_state_cookie(request, response, state, oauth2_state.expires_at)
        return response

    QueryOrForm = Query if callback_method == "GET" else Form

    @router.api_route(
        "/callback", name=f"auth.{identifier}.callback", methods=[callback_method]
    )
    async def _callback(
        request: Request,
        code: str | None = QueryOrForm(None),
        error: str | None = QueryOrForm(None),
        error_description: str | None = QueryOrForm(None),
        error_uri: str | None = QueryOrForm(None),
        state: str | None = QueryOrForm(None),
        factor: OAuth2Factor[typing.Any] = Depends(factor_dependency),
        authentication_session: AuthenticationSession | None = Depends(
            get_optional_authentication_session
        ),
        authentication_session_service: AuthenticationSessionService = Depends(
            get_authentication_session_service
        ),
    ) -> RedirectResponse:
        if state is None:
            raise PolarAuthRedirectionError("Missing OAuth2 state")

        # Skip state binding for POST callbacks, as we can't rely on cookies being sent in this case.
        if request.method != "POST":
            state_cookie = request.cookies.get(settings.OAUTH2_SESSION_STATE_COOKIE_KEY)
            if state_cookie is None:
                raise PolarAuthRedirectionError("Missing OAuth2 state cookie")

            if state != state_cookie:
                raise PolarAuthRedirectionError("Invalid OAuth2 state")

        try:
            enrollment, oauth_account, oauth_state = await factor.callback(
                code=code,
                state=state,
                error=error,
                error_description=error_description,
                error_uri=error_uri,
            )
        except OAuth2CallbackException as e:
            raise PolarAuthRedirectionError(e.message or "OAuth2 callback error") from e
        except OAuth2TokenException as e:
            raise PolarAuthRedirectionError("OAuth2 error") from e

        # In POST callback flows, we can't rely on cookies for state management,
        # so we need to retrieve the authentication session using the token hash stored in the state.
        if authentication_session is None:
            context = oauth_state.context
            if context is None:
                raise PolarAuthRedirectionError("No active authentication session")
            authentication_session_token_hash = context.get(
                "authentication_session_token_hash"
            )
            if authentication_session_token_hash is None:
                raise PolarAuthRedirectionError("No active authentication session")
            authentication_session = (
                await authentication_session_service.get_by_token_hash(
                    authentication_session_token_hash
                )
            )
            if authentication_session is None:
                raise PolarAuthRedirectionError("No active authentication session")

        # Existing or linked user
        if enrollment is not None:
            identity_id = enrollment.identity_id
        # New user
        else:
            assert oauth_account is not None

            try:
                email = await typing.cast(OAuth2FactorMixin, factor).get_email(
                    oauth_account
                )
            except GetEmailError as e:
                raise PolarAuthRedirectionError(e.message) from e

            user, _ = await user_service.get_by_email_or_create(
                authentication_session_service.session, email
            )
            enrollment = await factor.enroll(user.id, oauth_account)
            identity_id = user.id

        authentication_session = await authentication_session_service.advance(
            authentication_session, identity_id, factor
        )
        response = RedirectResponse(
            settings.generate_frontend_url("/auth"), status_code=303
        )
        _set_state_cookie(request, response, "", 0)
        return response

    return router


def get_oauth_link_router(
    factor_dependency: typing.Callable[..., Awaitable[OAuth2Factor[typing.Any]]],
    identifier: str,
) -> APIRouter:
    router = APIRouter(prefix=f"/{identifier}/link", include_in_schema=False)

    @router.get("/authorize", name=f"auth.{identifier}.link_authorize")
    async def _authorize(
        request: Request,
        auth_subject: AuthorizeWebUserWrite,
        return_to: ReturnTo,
        factor: OAuth2Factor[typing.Any] = Depends(factor_dependency),
    ) -> RedirectResponse:
        redirect_uri = str(request.url_for(f"auth.{identifier}.link_callback"))

        authorization_url, state, oauth2_state = await factor.start(
            redirect_uri=redirect_uri,
            scope=typing.cast(OAuth2FactorMixin, factor).SCOPE,
            identity_id=auth_subject.subject.id,
            nonce=secrets.token_urlsafe(16),
            extra={"prompt": "select_account"},
            return_to=return_to,
        )

        response = RedirectResponse(authorization_url, status_code=303)
        _set_state_cookie(request, response, state, oauth2_state.expires_at)
        return response

    @router.get("/callback", name=f"auth.{identifier}.link_callback")
    async def _callback(
        request: Request,
        auth_subject: AuthorizeWebUserWrite,
        code: str | None = Query(None),
        error: str | None = Query(None),
        error_description: str | None = Query(None),
        error_uri: str | None = Query(None),
        state: str | None = Query(None),
        factor: OAuth2Factor[typing.Any] = Depends(factor_dependency),
    ) -> RedirectResponse:
        default_return_to = settings.generate_frontend_url(
            "/dashboard/account/preferences"
        )
        error_parameters = {"type": "oauth_link_error", "factor": identifier}
        if state is None:
            raise PolarAuthRedirectionError(
                "Missing OAuth2 state", url=default_return_to, **error_parameters
            )

        state_cookie = request.cookies.get(settings.OAUTH2_SESSION_STATE_COOKIE_KEY)
        if state_cookie is None:
            raise PolarAuthRedirectionError(
                "Missing OAuth2 state cookie", url=default_return_to, **error_parameters
            )

        if state != state_cookie:
            raise PolarAuthRedirectionError(
                "Invalid OAuth2 state", url=default_return_to, **error_parameters
            )

        try:
            _, _, oauth_state = await factor.callback(
                code=code,
                state=state,
                error=error,
                error_description=error_description,
                error_uri=error_uri,
            )
        except OAuth2IdentityMismatchException as e:
            return_to = e.state.context.get("return_to") if e.state.context else None
            raise PolarAuthRedirectionError(
                "This account is already linked to another user",
                url=return_to or default_return_to,
                **error_parameters,
            ) from e
        except OAuth2CallbackException as e:
            return_to = e.state.context.get("return_to") if e.state.context else None
            raise PolarAuthRedirectionError(
                e.message or "OAuth2 callback error",
                url=return_to or default_return_to,
                **error_parameters,
            ) from e
        except OAuth2TokenException as e:
            return_to = e.state.context.get("return_to") if e.state.context else None
            raise PolarAuthRedirectionError(
                "OAuth2 error", url=return_to or default_return_to, **error_parameters
            ) from e

        return_to = (
            oauth_state.context.get("return_to") if oauth_state.context else None
        )
        response = RedirectResponse(return_to or default_return_to, status_code=303)
        _set_state_cookie(request, response, "", 0)
        return response

    return router
