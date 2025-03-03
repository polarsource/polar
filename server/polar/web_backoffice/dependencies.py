from fastapi import Depends
from fastapi.exceptions import HTTPException

from polar.auth.dependencies import get_user_session
from polar.models.user_session import UserSession


async def get_admin(
    user_session: UserSession | None = Depends(get_user_session),
) -> UserSession:
    if user_session is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    user = user_session.user
    if user.github_username not in {
        "birkjernstrom",
        "frankie567",
        "emilwidlund",
    }:
        raise HTTPException(status_code=403, detail="Forbidden")

    return user_session
