from urllib.parse import urlencode

from fastapi import Depends, Form, Request
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.integrations.loops.service import loops as loops_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.email import EmailStrDNS
from polar.kit.http import ReturnTo
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter

from .schemas import LoginCodeRequest
from .service import LoginCodeError
from .service import login_code as login_code_service

router = APIRouter(prefix="/login-code", tags=["login_code", APITag.private])


@router.post("/request", status_code=202)
async def request_login_code(
    login_code_request: LoginCodeRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Request a login code.
    """
    code_model, code = await login_code_service.request(
        session,
        login_code_request.email,
        return_to=login_code_request.return_to,
        signup_attribution=login_code_request.attribution,
    )

    # Send the code email
    await login_code_service.send(code_model, code)


@router.post("/authenticate")
async def authenticate_login_code(
    request: Request,
    return_to: ReturnTo,
    email: EmailStrDNS,
    auth_subject: WebUserOrAnonymous,
    code: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    """
    Authenticate with a login code.
    """
    if is_user(auth_subject):
        return RedirectResponse(return_to, 303)

    try:
        user, is_signup = await login_code_service.authenticate(
            session, code=code, email=email
        )
    except LoginCodeError as e:
        base_url = str(settings.generate_frontend_url("/login/code/verify"))
        url_params = {
            "return_to": return_to,
            "email": request.query_params.get("email"),
            "error": e.message,
        }
        failed_login_return_to = f"{base_url}?{urlencode(url_params)}"
        return RedirectResponse(failed_login_return_to, 303)

    # Event tracking last to ensure business critical data is stored first
    if is_signup:
        posthog.user_signup(user, "code")
        await loops_service.user_signup(user, emailLogin=True)
    else:
        posthog.user_login(user, "code")
        await loops_service.user_update(session, user, emailLogin=True)

    return await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
