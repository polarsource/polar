from fastapi import APIRouter, Depends, Query, Request, status
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import Auth
from polar.auth.service import AuthService
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.kit.db.postgres import AsyncSession
from polar.models.user import User
from polar.postgres import get_db_session
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
    request: Request,
    magic_link_request: MagicLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    magic_link, token = await magic_link_service.request(
        session, magic_link_request, source="user_login"
    )
    base_url = str(request.url_for("magic_link.authenticate"))
    await magic_link_service.send(
        magic_link,
        token,
        base_url,
        goto_url=settings.get_goto_url(magic_link_request.goto_url),
    )


@router.get("/authenticate", name="magic_link.authenticate", tags=[Tags.INTERNAL])
async def authenticate_magic_link(
    request: Request,
    goto_url: str | None = None,
    token: str = Query(),
    auth: Auth = Depends(Auth.optional_user),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    goto_url = settings.get_goto_url(goto_url)

    if isinstance(auth.subject, User):
        return RedirectResponse(goto_url, 303)

    try:
        user = await magic_link_service.authenticate(session, token)
    except MagicLinkError as e:
        raise PolarRedirectionError(e.message, e.status_code) from e

    return AuthService.generate_login_cookie_response(
        request=request, user=user, goto_url=goto_url
    )
