from urllib.parse import urlencode, urlsplit

from fastapi import Depends, Request
from fastapi.exceptions import HTTPException

from polar.config import settings
from polar.models import BackofficeUserSession
from polar.postgres import AsyncSession, get_db_session

from .auth.service import get_user_session


async def get_admin(
    request: Request,
    session: AsyncSession = Depends(get_db_session),
) -> BackofficeUserSession:
    user_session = await get_user_session(request, session)
    if user_session is not None:
        return user_session

    current_url = urlsplit(request.headers.get("HX-Current-URL") or str(request.url))
    return_to = current_url._replace(scheme="", netloc="", fragment="").geturl()
    login_url = f"{settings.generate_backoffice_url('/auth/')}?{urlencode({'return_to': return_to})}"
    if request.headers.get("HX-Request") == "true":
        raise HTTPException(status_code=401, headers={"HX-Redirect": login_url})
    if request.method in ("GET", "HEAD"):
        raise HTTPException(status_code=303, headers={"Location": login_url})
    raise HTTPException(status_code=401, detail="Unauthorized")
