from enum import Enum
from typing import Self
from uuid import UUID

from fastapi import Depends

from polar.models.account import Account
from polar.models.organization import Organization
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


class Anonymous:
    ...


Subject = User | Anonymous


class AccessType(str, Enum):
    read = "read"
    write = "write"


Object = User | Organization | Repository | Account


class Authz:
    session: AsyncSession

    def __init__(self, session: AsyncSession):
        self.session = session

    @classmethod
    async def authz(cls, session: AsyncSession = Depends(get_db_session)) -> Self:
        return cls(session=session)

    async def can(
        self, subject: Subject, accessType: AccessType, object: Object
    ) -> bool:
        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Repository)
        ):
            return self._can_user_read_repository(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Repository)
        ):
            return self._can_user_write_repository(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Organization)
        ):
            return await self._can_user_write_organization(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Account)
        ):
            return await self._can_user_read_account(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Account)
        ):
            return self._can_user_write_account(subject, object)

        return False

    def _can_user_read_repository(self, subject: User, object: Repository) -> bool:
        if object.is_private is False:
            return True

        if object.organization_id and self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    def _can_user_write_repository(self, subject: User, object: Repository) -> bool:
        if object.organization_id and self._is_member_and_admin(
            subject.id, object.organization_id
        ):
            return True
        return False

    async def _can_user_write_organization(
        self, subject: User, object: Organization
    ) -> bool:
        if await self._is_member_and_admin(subject.id, object.id):
            return True
        return False

    async def _can_user_read_account(self, subject: User, object: Account) -> bool:
        # Can read if owned by self
        # if object.user_id and subject.id == object.user_id:
        #     return True

        # Can read if owned by member org
        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    def _can_user_write_account(self, subject: User, object: Account) -> bool:
        # Can write if owned by self
        # if object.user_id and subject.id == object.user_id:
        #     return True

        # Can write if marked as admin
        if subject.id == object.admin_id:
            return True

        return False

    async def _is_member(self, user_id: UUID, organization_id: UUID) -> bool:
        memberships = await user_organization_service.list_by_user_id(
            self.session, user_id
        )

        for m in memberships:
            if m.organization_id == organization_id:
                return True

        return False

    async def _is_member_and_admin(self, user_id: UUID, organization_id: UUID) -> bool:
        memberships = await user_organization_service.list_by_user_id(
            self.session, user_id
        )

        for m in memberships:
            if m.organization_id == organization_id and m.is_admin:
                return True

        return False
