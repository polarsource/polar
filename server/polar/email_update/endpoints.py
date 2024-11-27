from fastapi import Depends, Form
from fastapi.responses import RedirectResponse

from polar.auth.dependencies import WebUser
from polar.config import settings
from polar.exceptions import PolarRedirectionError
from polar.integrations.loops.service import loops as loops_service
from polar.kit.db.postgres import AsyncSession
from polar.kit.http import ReturnTo, get_safe_return_url
from polar.openapi import APITag
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .schemas import EmailUpdateRequest
from .service import EmailUpdateError
from .service import email_update as email_upate_service

router = APIRouter(prefix="/email_update", tags=["email_update", APITag.private])


@router.post("/request")
async def request_email_update(
    email_update_request: EmailUpdateRequest,
    auth_subject: WebUser,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user = auth_subject.subject
    user_id = user.id
    email_update_record, token = await email_upate_service.request_email_update(
        email_update_request.email,
        session,
        user_id,
    )

    await email_upate_service.send_email(
        email_update_record,
        token,
        base_url=str(settings.generate_frontend_url("/update_email/authenticate")),
        extra_url_params=(
            {"return_to": email_update_request.return_to}
            if email_update_request.return_to
            else {}
        ),
    )


@router.post("/authenticate")
async def authenticate_email_update(
    return_to: ReturnTo,
    token: str = Form(),
    session: AsyncSession = Depends(get_db_session),
) -> RedirectResponse:
    try:
        user = await email_upate_service.authenticate(session, token)
    except EmailUpdateError as e:
        raise PolarRedirectionError(
            e.message, e.status_code, return_to=return_to
        ) from e

    await loops_service.user_update(session, user, emailLogin=True)

    return_url = get_safe_return_url(return_to)
    response = RedirectResponse(return_url, 303)

    return response
