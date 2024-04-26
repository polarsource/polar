from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import WebUserOrAnonymous
from polar.auth.models import is_user
from polar.auth.service import AuthService
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo
from polar.postgres import get_db_session
from polar.posthog import posthog
from polar.tags.api import Tags

from .schemas import MagicLinkRequest
from .service import MagicLinkError
from .service import magic_link as magic_link_service

router = APIRouter(prefix="/magic_link", tags=["magic_link"])


@router.post(
    "/request",
    name="magic_link.request",
    status_code=status.HTTP_202_ACCEPTED,
    tags=[Tags.INTERNAL],
)
async def request_magic_link(
    magic_link_request: MagicLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    magic_link, token = await magic_link_service.request(
        session, magic_link_request.email, source="user_login"
    )

    await magic_link_service.send(
        magic_link,
        token,
        base_url=str(settings.generate_external_url("/magic_link/authenticate")),
        extra_url_params={"return_to": magic_link_request.return_to}
        if magic_link_request.return_to
        else {},
    )


@router.get("/authenticate", name="magic_link.authenticate", tags=[Tags.INTERNAL])
async def authenticate_magic_link(
    request: Request,
    return_to: ReturnTo,
    auth_subject: WebUserOrAnonymous,
    token: str = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    if is_user(auth_subject):
        return RedirectResponse(return_to, 303)

    try:
        user = await magic_link_service.authenticate(session, token)
    except MagicLinkError as e:
        raise PolarRedirectionError(
            e.message, e.status_code, return_to=return_to
        ) from e

    posthog.auth_subject_event(auth_subject, "user", "magic_link_verified", "submit")

    return AuthService.generate_login_cookie_response(
        request=request, user=user, return_to=return_to
    )
