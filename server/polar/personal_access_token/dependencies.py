from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.kit.utils import utc_now
from polar.models import PersonalAccessToken
from polar.postgres import AsyncSession, get_db_session
from polar.worker import enqueue_job

from .service import personal_access_token as personal_access_token_service

auth_header_scheme = HTTPBearer(
    auto_error=False,
    description="You can generate a **Personal Access Token** from your [settings](https://polar.sh/settings).",
)


async def get_optional_personal_access_token(
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> PersonalAccessToken | None:
    if auth_header is None:
        return None

    token = await personal_access_token_service.get_by_token(
        session, auth_header.credentials
    )

    if token is not None:
        enqueue_job(
            "personal_access_token.record_usage",
            personal_access_token_id=token.id,
            last_used_at=utc_now(),
        )

    return token


async def get_personal_access_token(
    personal_access_token: PersonalAccessToken | None = Depends(
        get_optional_personal_access_token
    ),
) -> PersonalAccessToken:
    if personal_access_token is None:
        raise HTTPException(status_code=401)
    return personal_access_token
