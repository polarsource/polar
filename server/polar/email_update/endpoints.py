from uuid import UUID
from fastapi import Depends
from polar.config import settings
from polar.email_update.schemas import EmailUpdateRequest
from polar.kit.db.postgres import AsyncSession
from polar.postgres import get_db_session
from polar.routing import APIRouter

from .service import email_update as email_upate_service

router = APIRouter(prefix="/email-update")
    
@router.post("/request")
async def request_email_update(
    email_update_request: EmailUpdateRequest,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    user_id = UUID("ed226214-a1a4-4a10-9ead-edc26c69e8f7")
    email_update_record, token = await email_upate_service.request_email_update(
        email_update_request.email,
        session,
        user_id,
    )
    
    await email_upate_service.send_email(
        email_update_record,
        token,
        base_url=str(settings.generate_frontend_url("/login/magic-link/authenticate")),
        extra_url_params=(
            {"return_to": email_update_request.return_to}
            if email_update_request.return_to
            else {}            
        )
    )