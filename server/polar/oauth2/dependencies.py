from collections.abc import Generator

from fastapi import Request

from polar.kit.db.postgres import SyncSessionMaker

from .authorization_server import AuthorizationServer
from .constants import SCOPES_SUPPORTED


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
