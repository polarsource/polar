from fastapi import APIRouter, Depends, Query, Request, Response, status

from polar.auth.service import AuthService, LoginResponse
from polar.kit.db.postgres import AsyncSession
from polar.postgres import get_db_session
from polar.tags.api import Tags

from .schemas import MagicLinkRequest
from .service import magic_link as magic_link_service

router = APIRouter(prefix="/magic_link", tags=["magic_link"])


@router.post("/request", status_code=status.HTTP_202_ACCEPTED, tags=[Tags.INTERNAL])
async def request_magic_link(
    magic_link_request: MagicLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    magic_link, token = await magic_link_service.request(session, magic_link_request)
    await magic_link_service.send(magic_link, token)


@router.post("/authenticate", tags=[Tags.INTERNAL])
async def authenticate_magic_link(
    request: Request,
    response: Response,
    token: str = Query(),
    session: AsyncSession = Depends(get_db_session),
) -> LoginResponse:
    user = await magic_link_service.authenticate(session, token)

    return AuthService.generate_login_cookie_response(
        request=request, response=response, user=user
    )
