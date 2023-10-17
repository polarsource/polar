import uuid
from collections.abc import Sequence
from typing import Any

from sqlalchemy import ColumnExpressionArgument, Select, func, or_, select
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

from ..schemas import (
    SubscriptionGroupDefault,
    SubscriptionGroupInitialize,
    SubscriptionGroupUpdate,
)

DEFAULT_SUBSCRIPTION_GROUPS: list[SubscriptionGroupDefault] = [
    SubscriptionGroupDefault(
        name="Hobby",
        description="Tiers best suited for individuals",
        icon="material-symbols/stream",
        color="#79A2E1",  # type: ignore
        order=1,
    ),
    SubscriptionGroupDefault(
        name="Pro",
        description="Tiers best suited for indie hackers & startups",
        icon="material-symbols/verified",
        color="#96ECD7",  # type: ignore
        order=2,
    ),
    SubscriptionGroupDefault(
        name="Business",
        description="Tiers best suited for companies & corporations",
        icon="material-symbols/business",
        color="#FFC58F",  # type: ignore
        order=3,
    ),
]


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


class SubscriptionGroupsAlreadyInitialized(SubscriptionGroupError):
    def __init__(
        self,
        organization_id: uuid.UUID | None = None,
        repository_id: uuid.UUID | None = None,
    ) -> None:
        assert bool(organization_id) != bool(repository_id)

        self.organization_id = organization_id
        self.repository_id = repository_id

        if organization_id is not None:
            message = (
                f"Subscription groups for organization {organization_id} "
                "are already initialized."
            )
        else:
            message = (
                f"Subscription groups for repository {repository_id} "
                "are already initialized."
            )
        super().__init__(message, 422)


class SubscriptionGroupService(
    ResourceService[
        SubscriptionGroup, SubscriptionGroupInitialize, SubscriptionGroupUpdate
    ]
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

    async def initialize(
        self,
        session: AsyncSession,
        authz: Authz,
        initialize_schema: SubscriptionGroupInitialize,
        user: User,
    ) -> list[SubscriptionGroup]:
        if initialize_schema.organization_id is not None:
            organization = await organization_service.get(
                session, initialize_schema.organization_id
            )
            if organization is None or not await authz.can(
                user, AccessType.write, organization
            ):
                raise OrganizationDoesNotExist(initialize_schema.organization_id)

            if await self._count_by_organization_or_repository(
                session, organization_id=organization.id
            ):
                raise SubscriptionGroupsAlreadyInitialized(
                    organization_id=organization.id
                )

        if initialize_schema.repository_id is not None:
            repository = await repository_service.get(
                session, initialize_schema.repository_id
            )
            if repository is None or not await authz.can(
                user, AccessType.write, repository
            ):
                raise RepositoryDoesNotExist(initialize_schema.repository_id)

            if await self._count_by_organization_or_repository(
                session, repository_id=repository.id
            ):
                raise SubscriptionGroupsAlreadyInitialized(repository_id=repository.id)

        subscription_groups: list[SubscriptionGroup] = []
        for default_subscription_group in DEFAULT_SUBSCRIPTION_GROUPS:
            subscription_group = SubscriptionGroup(
                **default_subscription_group.dict(exclude={"color"}),
                color=str(default_subscription_group.color),
                **initialize_schema.dict(),
                tiers=[],
            )
            session.add(subscription_group)
            subscription_groups.append(subscription_group)
        await session.commit()

        return subscription_groups

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

    async def _count_by_organization_or_repository(
        self,
        session: AsyncSession,
        *,
        organization_id: uuid.UUID | None = None,
        repository_id: uuid.UUID | None = None,
    ) -> int:
        assert bool(organization_id) != bool(repository_id)

        statement = select(SubscriptionGroup).with_only_columns(func.count("*"))

        if organization_id is not None:
            statement = statement.where(
                SubscriptionGroup.organization_id == organization_id
            )

        if repository_id is not None:
            statement = statement.where(
                SubscriptionGroup.repository_id == repository_id
            )

        result = await session.execute(statement)
        return result.scalar_one()


subscription_group = SubscriptionGroupService(SubscriptionGroup)
