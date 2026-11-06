from uuid import UUID

from reauth.authentication_session import AuthenticationSession
from reauth.timestamp import get_current_timestamp
from sqlalchemy import delete, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import contains_eager

from polar.kit.crypto import get_token_hash_candidates
from polar.kit.repository import RepositoryBase, RepositoryTokenHashMixin
from polar.kit.utils import utc_now
from polar.models import (
    BackofficeAuthenticationSession,
    BackofficeUser,
    BackofficeUserSession,
)


class BackofficeAuthenticationSessionRepository(
    RepositoryBase[BackofficeAuthenticationSession]
):
    model = BackofficeAuthenticationSession

    async def get_by_token_hash(self, token_hash: str) -> AuthenticationSession | None:
        statement = (
            select(BackofficeAuthenticationSession)
            .where(
                BackofficeAuthenticationSession.token_hash == token_hash,
                BackofficeAuthenticationSession.deleted_at.is_(None),
            )
            .with_for_update()
        )
        session = await self.get_one_or_none(statement)
        return session.to_dataclass() if session is not None else None

    async def insert_session(self, session: AuthenticationSession) -> UUID:
        record = await self.create(
            BackofficeAuthenticationSession(
                token_hash=session.token_hash,
                expires_at=session.expires_at,
                step=session.step,
                authentication_method_references=session.amr,
                used_factors=session.used_factors,
                context=session.context,
                identity_id=session.identity_id,
            ),
            flush=True,
        )
        return record.id

    async def update_session(self, session: AuthenticationSession) -> None:
        await self.session.execute(
            update(BackofficeAuthenticationSession)
            .where(BackofficeAuthenticationSession.id == session.id)
            .values(
                step=session.step,
                authentication_method_references=session.amr,
                used_factors=session.used_factors,
                identity_id=session.identity_id,
            )
        )

    async def delete_session(self, session: AuthenticationSession) -> None:
        await self.session.execute(
            delete(BackofficeAuthenticationSession).where(
                BackofficeAuthenticationSession.id == session.id
            )
        )

    async def delete_expired(self) -> None:
        await self.session.execute(
            delete(BackofficeAuthenticationSession).where(
                BackofficeAuthenticationSession.expires_at <= get_current_timestamp()
            )
        )


class BackofficeUserRepository(RepositoryBase[BackofficeUser]):
    model = BackofficeUser

    async def provision(self, provider_id: str, email: str) -> BackofficeUser | None:
        statement = insert(BackofficeUser).values(provider_id=provider_id, email=email)
        upsert = statement.on_conflict_do_update(
            index_elements=[BackofficeUser.provider_id],
            set_={"email": statement.excluded.email},
            where=BackofficeUser.deleted_at.is_(None),
        ).returning(BackofficeUser)
        return (await self.session.scalars(upsert)).one_or_none()


class BackofficeUserSessionRepository(
    RepositoryBase[BackofficeUserSession],
    RepositoryTokenHashMixin[BackofficeUserSession],
):
    model = BackofficeUserSession
    token_hash_attribute = "token_hash"

    async def get_active(self, token: str) -> BackofficeUserSession | None:
        candidates = get_token_hash_candidates(token)
        statement = (
            select(BackofficeUserSession)
            .join(BackofficeUserSession.user)
            .options(contains_eager(BackofficeUserSession.user))
            .where(
                self.token_hash_clause(candidates),
                BackofficeUserSession.expires_at > utc_now(),
                BackofficeUserSession.deleted_at.is_(None),
                BackofficeUser.deleted_at.is_(None),
            )
        )
        user_session = await self.get_one_or_none(statement)
        if user_session is None:
            return None
        return await self.rehash_token(user_session, candidates)

    async def revoke(self, token: str) -> None:
        await self.session.execute(
            delete(BackofficeUserSession).where(
                self.token_hash_clause(get_token_hash_candidates(token))
            )
        )

    async def delete_expired(self) -> None:
        await self.session.execute(
            delete(BackofficeUserSession).where(
                BackofficeUserSession.expires_at <= utc_now()
            )
        )
