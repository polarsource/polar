from fastapi import APIRouter, Depends

from polar.api.auth import SECRET, auth_backend, github_oauth_client
from polar.api.deps import current_active_user, fastapi_users
from polar.models import User
from polar.schema.user import UserCreate, UserRead, UserUpdate

router = APIRouter()

# app.include_router(
#     fastapi_users.get_auth_router(auth_backend), prefix="/auth/jwt", tags=["auth"]
# )
# router.include_router(
#     fastapi_users.get_register_router(UserRead, UserCreate),
#     prefix="/auth",
#     tags=["auth"],
# )
# app.include_router(
#     fastapi_users.get_reset_password_router(),
#     prefix="/auth",
#     tags=["auth"],
# )
# router.include_router(
#     fastapi_users.get_verify_router(UserRead),
#     prefix="/auth",
#     tags=["auth"],
# )
router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
    prefix="/users",
    tags=["users"],
)
router.include_router(
    fastapi_users.get_oauth_router(
        github_oauth_client, auth_backend, SECRET, associate_by_email=True
    ),
    prefix="/github",
    tags=["auth"],
)


@router.get("/authenticated-route")
async def authenticated_route(user: User = Depends(current_active_user)):
    return {"message": f"Hello {user.email}!"}
