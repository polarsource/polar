from collections.abc import Generator

from fastapi import Depends, HTTPException, Request
from fastapi.security import OpenIdConnect
from fastapi.security.utils import get_authorization_scheme_param

from polar.authz.scope import SCOPES_SUPPORTED
from polar.kit.db.postgres import SyncSessionMaker
from polar.models import OAuth2Token
from polar.postgres import AsyncSession, get_db_session

from .authorization_server import AuthorizationServer
from .service.oauth2_token import oauth2_token as oauth2_token_service

openid_scheme = OpenIdConnect(
    openIdConnectUrl="/.well-known/openid-configuration", auto_error=False
)


async def get_optional_token(
    authorization: str = Depends(openid_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> OAuth2Token | None:
    scheme, access_token = get_authorization_scheme_param(authorization)
    if not authorization or scheme.lower() != "bearer":
        return None

    return await oauth2_token_service.get_by_access_token(session, access_token)


async def get_token(
    token: OAuth2Token | None = Depends(get_optional_token),
) -> OAuth2Token:
    if token is None:
        raise HTTPException(status_code=401)
    return token


def get_authorization_server(
    request: Request,
) -> Generator[AuthorizationServer, None, None]:
    sync_sessionmaker: SyncSessionMaker = request.state.sync_sessionmaker
    with sync_sessionmaker() as session:
        authorization_server = AuthorizationServer.build(
            session, scopes_supported=SCOPES_SUPPORTED
        )
        try:
            yield authorization_server
        except:
            session.rollback()
            raise
        else:
            session.commit()
