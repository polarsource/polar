from collections.abc import Sequence
from datetime import datetime
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.email.renderer import get_email_renderer
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.integrations.loops.service import loops as loops_service
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import OrganizationAccessToken, User
from polar.organization.resolver import get_payload_organization
from polar.postgres import AsyncSession
from polar.user_organization.service import (
    user_organization as user_organization_service,
)

from .repository import OrganizationAccessTokenRepository
from .schemas import OrganizationAccessTokenCreate, OrganizationAccessTokenUpdate

log: Logger = structlog.get_logger()

TOKEN_PREFIX = "polar_oat_"


class OrganizationAccessTokenService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[OrganizationAccessToken], int]:
        repository = OrganizationAccessTokenRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def get(
        self, session: AsyncSession, auth_subject: AuthSubject[User], id: UUID
    ) -> OrganizationAccessToken | None:
        repository = OrganizationAccessTokenRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            OrganizationAccessToken.id == id,
            OrganizationAccessToken.deleted_at.is_(None),
        )
        return await repository.get_one_or_none(statement)

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> OrganizationAccessToken | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        repository = OrganizationAccessTokenRepository.from_session(session)
        return await repository.get_by_token_hash(token_hash, expired=expired)

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        create_schema: OrganizationAccessTokenCreate,
    ) -> tuple[OrganizationAccessToken, str]:
        organization = await get_payload_organization(
            session, auth_subject, create_schema
        )
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=TOKEN_PREFIX
        )
        organization_access_token = OrganizationAccessToken(
            **create_schema.model_dump(
                exclude={"scopes", "expires_in", "organization_id"}
            ),
            organization=organization,
            token=token_hash,
            expires_at=utc_now() + create_schema.expires_in
            if create_schema.expires_in
            else None,
            scope=" ".join(create_schema.scopes),
        )
        repository = OrganizationAccessTokenRepository.from_session(session)
        organization_access_token = await repository.create(
            organization_access_token, flush=True
        )

        user = auth_subject.subject
        await loops_service.user_created_personal_access_token(session, user)

        return organization_access_token, token

    async def update(
        self,
        session: AsyncSession,
        organization_access_token: OrganizationAccessToken,
        update_schema: OrganizationAccessTokenUpdate,
    ) -> OrganizationAccessToken:
        repository = OrganizationAccessTokenRepository.from_session(session)

        update_dict = update_schema.model_dump(exclude={"scopes"}, exclude_unset=True)
        if update_schema.scopes is not None:
            update_dict["scope"] = " ".join(update_schema.scopes)

        return await repository.update(
            organization_access_token, update_dict=update_dict
        )

    async def delete(
        self, session: AsyncSession, organization_access_token: OrganizationAccessToken
    ) -> None:
        repository = OrganizationAccessTokenRepository.from_session(session)
        await repository.soft_delete(organization_access_token)

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None = None,
    ) -> bool:
        organization_access_token = await self.get_by_token(session, token)

        if organization_access_token is None:
            return False

        repository = OrganizationAccessTokenRepository.from_session(session)
        await repository.soft_delete(organization_access_token)

        email_renderer = get_email_renderer(
            {"organization_access_token": "polar.organization_access_token"}
        )

        subject, body = email_renderer.render_from_template(
            "Security Notice - Your Polar Organization Access Token has been leaked",
            "organization_access_token/leaked_token.html",
            {
                "organization_access_token": organization_access_token.comment,
                "notifier": notifier,
                "url": url,
                "current_year": datetime.now().year,
            },
        )

        organization_members = await user_organization_service.list_by_org(
            session, organization_access_token.organization_id
        )
        for organization_member in organization_members:
            enqueue_email(
                to_email_addr=organization_member.user.email,
                subject=subject,
                html_content=body,
            )

        log.info(
            "Revoke leaked organization access token",
            id=organization_access_token.id,
            notifier=notifier,
            url=url,
        )

        return True


organization_access_token = OrganizationAccessTokenService()
