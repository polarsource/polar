from collections.abc import Generator

from fastapi import Depends, Request
from fastapi.security import OpenIdConnect
from fastapi.security.utils import get_authorization_scheme_param

from polar.exceptions import Unauthorized
from polar.kit.db.postgres import SyncSessionMaker
from polar.models import OAuth2Token
from polar.postgres import AsyncSession, get_db_session

from .authorization_server import AuthorizationServer
from .exceptions import InvalidTokenError
from .service.oauth2_token import oauth2_token as oauth2_token_service

openid_scheme = OpenIdConnect(
    scheme_name="oidc",
    openIdConnectUrl="/.well-known/openid-configuration",
    auto_error=False,
)


async def get_optional_token(
    authorization: str = Depends(openid_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> tuple[OAuth2Token | None, bool]:
    scheme, access_token = get_authorization_scheme_param(authorization)
    if not authorization or scheme.lower() != "bearer":
        return None, False

    token = await oauth2_token_service.get_by_access_token(session, access_token)
    return token, True


async def get_token(
    credentials: tuple[OAuth2Token | None, bool] = Depends(get_optional_token),
) -> OAuth2Token:
    token, authorization_set = credentials
    if token is None:
        if authorization_set:
            raise InvalidTokenError()
        raise Unauthorized()
    return token


def get_authorization_server(
    request: Request,
) -> Generator[AuthorizationServer, None, None]:
    sync_sessionmaker: SyncSessionMaker = request.state.sync_sessionmaker
    with sync_sessionmaker() as session:
        authorization_server = AuthorizationServer.build(session)
        try:
            yield authorization_server
        except:
            session.rollback()
            raise
        else:
            session.commit()
