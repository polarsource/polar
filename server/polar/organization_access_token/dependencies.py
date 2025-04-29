from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.kit.utils import utc_now
from polar.models import OrganizationAccessToken
from polar.postgres import AsyncSession, get_db_session
from polar.worker import enqueue_job

from .service import organization_access_token as organization_access_token_service

auth_header_scheme = HTTPBearer(
    scheme_name="oat",
    auto_error=False,
    description="You can generate an **Organization Access Token** from your organization's settings.",
)


async def get_optional_organization_access_token(
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> tuple[OrganizationAccessToken | None, bool]:
    if auth_header is None:
        return None, False

    token = await organization_access_token_service.get_by_token(
        session, auth_header.credentials
    )

    if token is not None:
        enqueue_job(
            "organization_access_token.record_usage",
            organization_access_token_id=token.id,
            last_used_at=utc_now().timestamp(),
        )

    return token, True
