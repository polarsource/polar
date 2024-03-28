import uuid

from sqlalchemy import select

from polar.exceptions import PolarError
from polar.kit.db.postgres import Session as SyncSession
from polar.kit.services import ResourceServiceReader
from polar.models import OAuth2Grant


class OAuth2GrantError(PolarError):
    ...


class OAuth2GrantService(ResourceServiceReader[OAuth2Grant]):
    def create_or_update_grant(
        self, session: SyncSession, *, user_id: uuid.UUID, client_id: str, scope: str
    ) -> OAuth2Grant:
        grant = self._get_by_user_and_client_id(
            session, user_id=user_id, client_id=client_id
        )
        if grant is None:
            grant = OAuth2Grant(user_id=user_id, client_id=client_id, scope=scope)
        else:
            grant.scope = scope

        session.add(grant)
        session.flush()
        return grant

    def has_granted_scope(
        self,
        session: SyncSession,
        *,
        user_id: uuid.UUID,
        client_id: str,
        scope: str,
    ) -> bool:
        grant = self._get_by_user_and_client_id(
            session, user_id=user_id, client_id=client_id
        )
        if grant is None:
            return False

        scopes = set(scope.strip().split())
        return scopes.issubset(grant.scopes)

    def _get_by_user_and_client_id(
        self, session: SyncSession, *, user_id: uuid.UUID, client_id: str
    ) -> OAuth2Grant | None:
        statement = select(OAuth2Grant).where(
            OAuth2Grant.user_id == user_id, OAuth2Grant.client_id == client_id
        )
        result = session.execute(statement)
        return result.unique().scalar_one_or_none()


oauth2_grant = OAuth2GrantService(OAuth2Grant)
