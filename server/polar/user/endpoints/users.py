from fastapi import APIRouter

from polar.api.auth import auth_backend
from polar.api.deps import fastapi_users

from ..schemas import UserRead, UserUpdate

router = APIRouter()

router.include_router(
    fastapi_users.get_users_router(UserRead, UserUpdate),
)

# TODO: Contribute to or patch fastapi-users to accept which routers to return.
# We want to skip returning the login (password form) endpoint here since we're
# solely using OAuth2.
router.include_router(
    fastapi_users.get_auth_router(auth_backend),
)
