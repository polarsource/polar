import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnExpressionArgument, Select, or_, select
from sqlalchemy.orm import joinedload, selectinload

from polar.account.service import account as account_service
from polar.authz.service import AccessType, Authz, Subject
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.models import (
    Account,
    Organization,
    Repository,
    SubscriptionGroup,
    User,
    UserOrganization,
)
from polar.organization.service import organization as organization_service
from polar.repository.service import repository as repository_service

from ..schemas import SubscriptionGroupCreate, SubscriptionGroupUpdate


class SubscriptionGroupError(PolarError):
    ...


class OrganizationDoesNotExist(SubscriptionGroupError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Organization with id {organization_id} does not exist."
        super().__init__(message, 422)


class RepositoryDoesNotExist(SubscriptionGroupError):
    def __init__(self, organization_id: uuid.UUID) -> None:
        self.organization_id = organization_id
        message = f"Repository with id {organization_id} does not exist."
        super().__init__(message, 422)


class SubscriptionGroupService(
    ResourceService[SubscriptionGroup, SubscriptionGroupCreate, SubscriptionGroupUpdate]
):
    async def search(
        self,
        session: AsyncSession,
        auth_subject: Subject,
        *,
        organization: Organization | None = None,
        repository: Repository | None = None,
        direct_organization: bool = True,
        pagination: PaginationParams,
    ) -> tuple[Sequence[SubscriptionGroup], int]:
        statement = self._get_readable_subscription_group_statement(auth_subject)

        statement = statement.options(selectinload(SubscriptionGroup.tiers))

        if organization is not None:
            clauses = [SubscriptionGroup.organization_id == organization.id]
            if not direct_organization:
                clauses.append(Repository.organization_id == organization.id)
            statement = statement.where(or_(*clauses))

        if repository is not None:
            statement = statement.where(
                SubscriptionGroup.repository_id == repository.id
            )

        statement = statement.order_by(
            SubscriptionGroup.organization_id,
            SubscriptionGroup.repository_id,
            SubscriptionGroup.order,
        )

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_with_organization_or_repository(
        self, session: AsyncSession, id: uuid.UUID
    ) -> SubscriptionGroup | None:
        statement = (
            select(SubscriptionGroup)
            .where(SubscriptionGroup.id == id, SubscriptionGroup.deleted_at.is_(None))
            .options(
                joinedload(SubscriptionGroup.organization),
                joinedload(SubscriptionGroup.repository),
            )
        )
        result = await session.execute(statement)
        return result.scalar_one_or_none()

    async def user_create(
        self,
        session: AsyncSession,
        authz: Authz,
        create_schema: SubscriptionGroupCreate,
        user: User,
    ) -> SubscriptionGroup:
        if create_schema.organization_id is not None:
            organization = await organization_service.get(
                session, create_schema.organization_id
            )
            if organization is None or not await authz.can(
                user, AccessType.write, organization
            ):
                raise OrganizationDoesNotExist(create_schema.organization_id)

        if create_schema.repository_id is not None:
            repository = await repository_service.get(
                session, create_schema.repository_id
            )
            if repository is None or not await authz.can(
                user, AccessType.write, repository
            ):
                raise RepositoryDoesNotExist(create_schema.repository_id)

        return await self.model.create(session, **create_schema.dict(), tiers=[])

    async def get_managing_organization_account(
        self, session: AsyncSession, subscription_group: SubscriptionGroup
    ) -> Account | None:
        return await account_service.get_by_org(
            session, subscription_group.managing_organization_id
        )

    def _get_readable_subscription_group_statement(
        self, auth_subject: Subject
    ) -> Select[Any]:
        clauses: list[ColumnExpressionArgument[bool]] = [
            SubscriptionGroup.repository_id.is_(None),
            Repository.is_private.is_(False),
        ]
        if isinstance(auth_subject, User):
            clauses.append(UserOrganization.user_id == auth_subject.id)

        return (
            select(SubscriptionGroup)
            .join(SubscriptionGroup.repository, full=True)
            .join(
                Organization,
                onclause=Organization.id == Repository.organization_id,
                full=True,
            )
            .join(
                UserOrganization,
                onclause=UserOrganization.organization_id == Organization.id,
                full=True,
            )
            .where(or_(*clauses))
        )


subscription_group = SubscriptionGroupService(SubscriptionGroup)
