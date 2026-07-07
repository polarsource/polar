from fastapi import Depends, Form
from fastapi.responses import RedirectResponse

from polar.authz.dependencies import AuthorizeWebUserWrite
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo, get_safe_return_url
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .schemas import EmailUpdateRequest
from .service import EmailUpdateError
from .service import email_update as email_update_service

router = APIRouter(prefix="/email-update", tags=["email-update", APITag.private])


@router.post("/request")
async def request_email_update(
    email_update_request: EmailUpdateRequest,
    auth_subject: AuthorizeWebUserWrite,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    result = await email_update_service.request_email_update(
        email_update_request.email,
        session,
        auth_subject,
    )
    if result is None:
        return
    email_update_record, token = result

    await email_update_service.send_email(
        email_update_record,
        token,
        base_url=str(settings.generate_frontend_url("/verify-email")),
        extra_url_params=(
            {"return_to": email_update_request.return_to}
            if email_update_request.return_to
            else {}
        ),
    )


@router.post("/verify")
async def verify_email_update(
    return_to: ReturnTo,
    auth_subject: AuthorizeWebUserWrite,
    token: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    try:
        user = await email_update_service.verify(session, token, auth_subject.subject)
    except EmailUpdateError as e:
        raise PolarRedirectionError(e.message, return_to=return_to) from e

    return_url = get_safe_return_url(return_to)
    response = RedirectResponse(return_url, 303)

    return response
