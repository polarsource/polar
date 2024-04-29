import pytest_asyncio

from polar.auth.models import AuthMethod, AuthSubject, S
from polar.auth.scope import Scope
from polar.config import settings
from polar.kit import jwt
from polar.models import User


@pytest_asyncio.fixture(scope="function")
async def auth_jwt(
    user: User,
) -> str:
    expires_at = jwt.create_expiration_dt(seconds=settings.AUTH_COOKIE_TTL_SECONDS)
    token = jwt.encode(
        data={
            "user_id": str(user.id),
        },
        secret=settings.SECRET,
        expires_at=expires_at,
        type="auth",
    )
    return token


@pytest_asyncio.fixture(scope="function")
async def user_second_auth_jwt(
    user_second: User,
) -> str:
    expires_at = jwt.create_expiration_dt(seconds=settings.AUTH_COOKIE_TTL_SECONDS)
    token = jwt.encode(
        data={
            "user_id": str(user_second.id),
        },
        secret=settings.SECRET,
        expires_at=expires_at,
        type="auth",
    )
    return token


def get_auth_subject(
    subject: S,
    *,
    scopes: set[Scope] = {Scope.web_default},
    auth_method: AuthMethod = AuthMethod.COOKIE,
) -> AuthSubject[S]:
    return AuthSubject[S](subject, scopes, auth_method)
