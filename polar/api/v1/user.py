from fastapi import APIRouter, Depends

from polar.api.auth import auth_backend, github_oauth_client
from polar.api.deps import current_active_user, fastapi_users
from polar.config import settings
from polar.models import User
from polar.schema.user import UserRead, UserUpdate

router = APIRouter()

router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)
router.include_router(
    fastapi_users.get_oauth_router(
        github_oauth_client, auth_backend, settings.SECRET, associate_by_email=True
    ),
    prefix="/github",
    tags=["auth"],
)


@router.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}
