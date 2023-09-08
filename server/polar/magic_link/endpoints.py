from fastapi import APIRouter, status, Depends, Query, Request, Response

from polar.tags.api import Tags
from polar.kit.db.postgres import AsyncSession
from polar.postgres import get_db_session
from polar.auth.service import AuthService, LoginResponse

from .schemas import MagicLinkRequest
from .service import magic_link as magic_link_service

router = APIRouter(prefix="/magic-link", tags=[Tags.INTERNAL])


@router.post("/request", status_code=status.HTTP_202_ACCEPTED)
async def request_magic_link(
    magic_link_request: MagicLinkRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    await magic_link_service.request(session, magic_link_request)


@router.post("/authenticate")
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
