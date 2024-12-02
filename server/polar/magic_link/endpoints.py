from fastapi import Depends, Form, Request, status
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import auth as auth_service
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.integrations.loops.service import loops as loops_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.posthog import posthog
from polar.routing import APIRouter

from .schemas import MagicLinkRequest
from .service import MagicLinkError
from .service import magic_link as magic_link_service

router = APIRouter(prefix="/magic_link", tags=["magic_link", APITag.private])


@router.post(
    "/request", name="magic_link.request", status_code=status.HTTP_202_ACCEPTED
)
async def request_magic_link(
    magic_link_request: MagicLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    magic_link, token = await magic_link_service.request(
        session,
        magic_link_request.email,
        source="user_login",
        signup_attribution=magic_link_request.attribution,
    )

    await magic_link_service.send(
        magic_link,
        token,
        base_url=str(settings.generate_frontend_url("/login/magic-link/authenticate")),
        extra_url_params=(
            {"return_to": magic_link_request.return_to}
            if magic_link_request.return_to
            else {}
        ),
    )


@router.post("/authenticate", name="magic_link.authenticate")
async def authenticate_magic_link(
    request: Request,
    return_to: ReturnTo,
    auth_subject: WebUserOrAnonymous,
    token: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if is_user(auth_subject):
        return RedirectResponse(return_to, 303)

    try:
        user, is_signup = await magic_link_service.authenticate(session, token)
    except MagicLinkError as e:
        raise PolarRedirectionError(
            e.message, e.status_code, return_to=return_to
        ) from e

    # Event tracking last to ensure business critical data is stored first
    if is_signup:
        posthog.user_signup(user, "ml")
        await loops_service.user_signup(user, emailLogin=True)
    else:
        posthog.user_login(user, "ml")
        await loops_service.user_update(session, user, emailLogin=True)

    return await auth_service.get_login_response(
        session, request, user, return_to=return_to
    )
