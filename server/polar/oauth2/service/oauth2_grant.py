import uuid

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert

from polar.kit.db.postgres import Session as SyncSession
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import generate_uuid, utc_now
from polar.models import OAuth2Grant

from ..sub_type import SubType

_USER_GRANT_CONSTRAINT = "oauth2_grants_client_id_user_id_key"
_ORGANIZATION_GRANT_CONSTRAINT = "oauth2_grants_client_id_organization_id_key"


class OAuth2GrantService(ResourceServiceReader[OAuth2Grant]):
    def create_or_update_grant(
        self,
        session: SyncSession,
        *,
        sub_type: SubType,
        sub_id: uuid.UUID,
        client_id: str,
        scope: str,
    ) -> OAuth2Grant:
        if sub_type == SubType.user:
            constraint = _USER_GRANT_CONSTRAINT
            user_id: uuid.UUID | None = sub_id
            organization_id: uuid.UUID | None = None
        elif sub_type == SubType.organization:
            constraint = _ORGANIZATION_GRANT_CONSTRAINT
            user_id = None
            organization_id = sub_id
        else:
            raise NotImplementedError()

        statement = (
            insert(OAuth2Grant)
            .values(
                id=generate_uuid(),
                created_at=utc_now(),
                client_id=client_id,
                scope=scope,
                user_id=user_id,
                organization_id=organization_id,
            )
            .on_conflict_do_update(
                constraint=constraint,
                set_={"scope": scope, "modified_at": utc_now()},
            )
            .returning(OAuth2Grant)
            .execution_options(populate_existing=True)
        )
        return session.execute(statement).unique().scalar_one()

    def has_granted_scope(
        self,
        session: SyncSession,
        *,
        sub_type: SubType,
        sub_id: uuid.UUID,
        client_id: str,
        scope: str,
    ) -> bool:
        grant = self._get_by_sub_and_client_id(
            session, sub_type=sub_type, sub_id=sub_id, client_id=client_id
        )
        if grant is None:
            return False

        scopes = set(scope.strip().split())
        return scopes.issubset(grant.scopes)

    def _get_by_sub_and_client_id(
        self,
        session: SyncSession,
        *,
        sub_type: SubType,
        sub_id: uuid.UUID,
        client_id: str,
    ) -> OAuth2Grant | None:
        statement = select(OAuth2Grant).where(OAuth2Grant.client_id == client_id)
        if sub_type == SubType.user:
            statement = statement.where(OAuth2Grant.user_id == sub_id)
        elif sub_type == SubType.organization:
            statement = statement.where(OAuth2Grant.organization_id == sub_id)
        else:
            raise NotImplementedError()
        result = session.execute(statement)
        return result.unique().scalar_one_or_none()


oauth2_grant = OAuth2GrantService(OAuth2Grant)
