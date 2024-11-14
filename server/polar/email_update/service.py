import datetime
from math import ceil
from urllib.parse import urlencode
from pydantic import UUID4
from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import get_email_sender
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import EmailVerification
from polar.postgres import AsyncSession

from .schemas import EmailUpdateCreate


TOKEN_PREFIX = "polar_ml_"

class EmailUpdateService(ResourceServiceReader[EmailVerification]):
    async def request_email_update(
        self,
        email: str,
        session: AsyncSession,
        user_id: UUID4,
        expire_at: datetime.datetime | None = None,
    ) -> tuple[EmailVerification, str]:
        token, token_hash = generate_token_hash_pair(secret=settings.SECRET, prefix=TOKEN_PREFIX)
        email_update_create = EmailUpdateCreate(
            email=email,
            token_hash=token_hash,
            expires_at=expire_at,
            user_id=user_id
        )
        
        email_update_record = EmailVerification(**email_update_create.model_dump(exclude_unset=True)) 
        
        session.add(email_update_record)
        await session.commit()
        
        return email_update_record, token
    
    async def send_email(
        self,
        email_update_record: EmailVerification,
        token: str,
        base_url: str,
        *,
        extra_url_params: dict[str, str] = {},
    ) -> None:
        email_renderer = get_email_renderer({"email_update": "polar.email_update"})        
        email_sender = get_email_sender()
        
        delta = email_update_record.expires_at - utc_now()
        token_lifetime_minutes = int(ceil(delta.seconds / 60))
        
        url_params = {"token": token, **extra_url_params}
        subject, body = email_renderer.render_from_template(
            "Update your email",
            "email_update/email_update.html",
            {
                "token_lifetime_minutes": token_lifetime_minutes,
                "url": f"{base_url}?{urlencode(url_params)}",
                "current_year": datetime.datetime.now().year,    
            }
        )
        
        email_sender.send_to_user(
            to_email_addr=email_update_record.email, subject=subject, html_content=body
        )
    
email_update = EmailUpdateService(EmailVerification)