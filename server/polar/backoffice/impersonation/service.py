from datetime import timedelta
from uuid import UUID

from polar.auth.scope import READ_ONLY_SCOPES
from polar.auth.service import auth as auth_service
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.models import Organization, UserSession
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository


class ImpersonationService:
    async def start(
        self,
        session: AsyncSession,
        admin_session: UserSession,
        *,
        user_id: UUID,
        organization_id: UUID | None,
        user_agent: str,
        current_token: str | None,
    ) -> tuple[str, UserSession, Organization]:
        target_user = await UserRepository.from_session(session).get_by_id(user_id)
        if target_user is None:
            raise ResourceNotFound("User not found")
        organizations = await OrganizationRepository.from_session(
            session
        ).get_all_by_user(target_user.id)
        organization = next(
            (org for org in organizations if org.id == organization_id),
            organizations[0] if organizations else None,
        )
        if organization is None:
            raise ResourceNotFound("User has no organizations to impersonate into")

        token, impersonation_session = await auth_service._create_user_session(
            session,
            target_user,
            user_agent=user_agent,
            scopes=list(READ_ONLY_SCOPES),
            expire_in=timedelta(minutes=60),
            organization_ids=frozenset({organization.id}),
        )
        await self._revoke_current(session, admin_session, current_token)
        return token, impersonation_session, organization

    async def end(
        self,
        session: AsyncSession,
        *,
        admin_token: str,
        current_token: str | None,
    ) -> tuple[UserSession, UUID | None]:
        if not admin_token.isascii():
            raise Unauthorized("Admin session expired or invalid")
        admin_session = await auth_service._get_user_session_by_token(
            session, admin_token
        )
        if (
            admin_session is None
            or not admin_session.user.can_authenticate
            or not admin_session.user.is_admin
        ):
            raise Unauthorized("Admin session expired or invalid")
        organization_id = await self._revoke_current(
            session, admin_session, current_token
        )
        return admin_session, organization_id

    async def _revoke_current(
        self,
        session: AsyncSession,
        admin_session: UserSession,
        current_token: str | None,
    ) -> UUID | None:
        if not current_token or not current_token.isascii():
            return None
        current_session = await auth_service._get_user_session_by_token(
            session, current_token
        )
        if current_session is None or current_session.id == admin_session.id:
            return None
        organization_id = (
            current_session.organization_scopes[0].organization_id
            if current_session.organization_scopes
            else None
        )
        await session.delete(current_session)
        return organization_id


impersonation = ImpersonationService()
