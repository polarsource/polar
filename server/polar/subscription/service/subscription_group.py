import uuid

from sqlalchemy import select
from sqlalchemy.orm import joinedload

from polar.authz.service import AccessType, Authz
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.services import ResourceService
from polar.models import SubscriptionGroup, User
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

        return await super().create(session, create_schema)


subscription_group = SubscriptionGroupService(SubscriptionGroup)
