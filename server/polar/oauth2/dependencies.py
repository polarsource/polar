from collections.abc import Generator

from fastapi import Request

from polar.kit.db.postgres import SyncSessionMaker

from .authorization_server import AuthorizationServer, RevocationEndpoint
from .constants import SCOPES_SUPPORTED
from .grants import register_grants


def get_authorization_server(
    request: Request,
) -> Generator[AuthorizationServer, None, None]:
    sync_sessionmaker: SyncSessionMaker = request.state.sync_sessionmaker
    with sync_sessionmaker() as session:
        authorization_server = AuthorizationServer(
            session, scopes_supported=SCOPES_SUPPORTED
        )
        authorization_server.register_endpoint(RevocationEndpoint)
        register_grants(authorization_server)
        try:
            yield authorization_server
        except:
            session.rollback()
            raise
        else:
            session.commit()
