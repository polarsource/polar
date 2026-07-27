import uuid

from fastapi import Depends
from reauth.crypto import get_token_hash
from reauth.factors.oauth2.state import (
    OAuth2State as OAuth2StateDataclass,
)
from reauth.factors.oauth2.state import (
    OAuth2StateService as OAuth2StateServiceBase,
)
from sqlalchemy import delete, select

from polar.config import settings
from polar.models import OAuth2State
from polar.postgres import AsyncSession, get_db_session

TOKEN_PREFIX = "polar_oauth2_"


class OAuth2StateService(OAuth2StateServiceBase):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session
        super().__init__(
            hash_secret=settings.SECRET,
            token_prefix=TOKEN_PREFIX,
            lifetime=settings.OAUTH2_SESSION_STATE_TTL,
        )

    async def insert(self, oauth2_state: OAuth2StateDataclass) -> uuid.UUID:
        oauth2_state_orm = OAuth2State(
            state_hash=oauth2_state.state_hash,
            provider=oauth2_state.provider,
            code_verifier=oauth2_state.code_verifier,
            nonce=oauth2_state.nonce,
            redirect_uri=oauth2_state.redirect_uri,
            scope=oauth2_state.scope,
            expires_at=oauth2_state.expires_at,
            identity_id=oauth2_state.identity_id,
            context=oauth2_state.context,
        )
        self.session.add(oauth2_state_orm)
        await self.session.flush()
        return oauth2_state_orm.id

    async def get_by_state_hash(self, state_hash: str) -> OAuth2StateDataclass | None:
        statement = select(OAuth2State).where(OAuth2State.state_hash == state_hash)
        result = await self.session.execute(statement)
        oauth2_state_orm = result.scalar_one_or_none()
        if oauth2_state_orm is None:
            return None
        return oauth2_state_orm.to_dataclass()

    async def get_by_token(self, token: str) -> OAuth2StateDataclass | None:
        state_hash = get_token_hash(token, secret=self.hash_secret)
        return await self.get_by_state_hash(state_hash)

    async def delete(self, oauth2_state: OAuth2StateDataclass) -> None:
        statement = delete(OAuth2State).where(OAuth2State.id == oauth2_state.id)
        await self.session.execute(statement)
        await self.session.flush()


async def get_oauth2_state_service(
    session: AsyncSession = Depends(get_db_session),
) -> OAuth2StateService:
    return OAuth2StateService(session)
