import uuid
from collections.abc import Sequence
from typing import Any
from uuid import UUID

import structlog
from sqlalchemy import UnaryExpression, asc, desc

from polar.auth.models import AuthSubject
from polar.config import settings
from polar.email.react import render_email_template
from polar.email.schemas import (
    OrganizationAccessTokenLeakedEmail,
    OrganizationAccessTokenLeakedProps,
)
from polar.email.sender import enqueue_email
from polar.enums import TokenType
from polar.integrations.loops.service import loops as loops_service
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.pagination import PaginationParams
from polar.kit.sorting import Sorting
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
from .sorting import OrganizationAccessTokenSortProperty

log: Logger = structlog.get_logger()

TOKEN_PREFIX = "polar_oat_"


class OrganizationAccessTokenService:
    async def list(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        *,
        organization_id: Sequence[uuid.UUID] | None = None,
        pagination: PaginationParams,
        sorting: list[Sorting[OrganizationAccessTokenSortProperty]] = [
            (OrganizationAccessTokenSortProperty.created_at, False)
        ],
    ) -> tuple[Sequence[OrganizationAccessToken], int]:
        repository = OrganizationAccessTokenRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject)

        if organization_id is not None:
            statement = statement.where(
                OrganizationAccessToken.organization_id.in_(organization_id)
            )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == OrganizationAccessTokenSortProperty.created_at:
                order_by_clauses.append(
                    clause_function(OrganizationAccessToken.created_at)
                )
            elif criterion == OrganizationAccessTokenSortProperty.comment:
                order_by_clauses.append(
                    clause_function(OrganizationAccessToken.comment)
                )
            elif criterion == OrganizationAccessTokenSortProperty.last_used_at:
                order_by_clauses.append(
                    clause_function(OrganizationAccessToken.last_used_at)
                )
            elif criterion == OrganizationAccessTokenSortProperty.organization_id:
                order_by_clauses.append(
                    clause_function(OrganizationAccessToken.organization_id)
                )
        statement = statement.order_by(*order_by_clauses)

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

        organization_members = await user_organization_service.list_by_org(
            session, organization_access_token.organization_id
        )
        for organization_member in organization_members:
            email = organization_member.user.email
            body = render_email_template(
                OrganizationAccessTokenLeakedEmail(
                    props=OrganizationAccessTokenLeakedProps(
                        email=email,
                        organization_access_token=organization_access_token.comment,
                        notifier=notifier,
                        url=url or "",
                    )
                )
            )
            enqueue_email(
                to_email_addr=email,
                subject="Security Notice - Your Polar Organization Access Token has been leaked",
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
