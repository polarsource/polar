from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from polar.models import CustomerSession
from polar.postgres import AsyncSession, get_db_session

from .service import customer_session as customer_session_service

auth_header_scheme = HTTPBearer(scheme_name="customer_session", auto_error=False)


async def get_optional_customer_session_token(
    auth_header: HTTPAuthorizationCredentials | None = Depends(auth_header_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> tuple[CustomerSession | None, bool]:
    if auth_header is None:
        return None, False

    token = await customer_session_service.get_by_token(
        session, auth_header.credentials
    )

    return token, True
