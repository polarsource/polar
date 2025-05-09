from enum import StrEnum
from typing import Self
from uuid import UUID

from fastapi import Depends

from polar.auth.models import Anonymous, Subject
from polar.models.account import Account
from polar.models.issue_reward import IssueReward
from polar.models.license_key import LicenseKey
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.product import Product
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


class AccessType(StrEnum):
    read = "read"
    write = "write"


Object = Account | Product | LicenseKey


class Authz:
    session: AsyncSession

    # request scoped caches
    _cache_can_user_read_repository_id: dict[tuple[UUID, UUID], bool]
    _cache_is_member: dict[tuple[UUID, UUID], bool]

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache_can_user_read_repository_id = {}
        self._cache_is_member = {}

    @classmethod
    async def authz(cls, session: AsyncSession = Depends(get_db_session)) -> Self:
        return cls(session=session)

    async def can(
        self, subject: Subject, accessType: AccessType, object: Object
    ) -> bool:
        # Check blocked subjects
        blocked_at = getattr(subject, "blocked_at", None)
        if blocked_at is not None:
            return False

        # Anoymous users can only read
        if (isinstance(subject, Anonymous)) and accessType != AccessType.read:
            return False

        #
        # Organization
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Organization)
        ):
            return await self._can_user_write_organization(subject, object)

        if (
            isinstance(subject, Organization)
            and isinstance(object, Organization)
            and subject == object
        ):
            return True

        if accessType == AccessType.read and isinstance(object, Organization):
            return True

        #
        # Account
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Account)
        ):
            return self._can_user_read_account(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Account)
        ):
            return self._can_user_write_account(subject, object)

        #
        # IssueReward
        #
        if isinstance(subject, Anonymous) and isinstance(object, IssueReward):
            return False

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, IssueReward)
        ):
            return await self._can_user_read_issue_reward(subject, object)

        #
        # Pledge
        #
        if isinstance(subject, Anonymous) and isinstance(object, Pledge):
            return await self._can_anonymous_read_pledge(object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Pledge)
        ):
            return await self._can_user_read_pledge(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Pledge)
        ):
            return await self._can_user_write_pledge(subject, object)

        #
        # SubscriptionTier
        #
        if isinstance(object, Product) and accessType == AccessType.write:
            if isinstance(subject, User):
                return await self._can_user_write_organization(
                    subject, object.organization
                )
            if isinstance(subject, Organization):
                return object.organization_id == subject.id

        #
        # License Key
        #
        if isinstance(object, LicenseKey):
            if isinstance(subject, User):
                is_member = await self._is_member(subject.id, object.organization_id)
                return is_member

            if isinstance(subject, Organization):
                return object.organization_id == subject.id

        raise Exception(
            f"Unknown subject/action/object combination. subject={type(subject)} access={accessType} object={type(object)}"  # noqa: E501
        )

    #
    # Organization
    #

    async def _can_user_write_organization(
        self, subject: User, object: Organization
    ) -> bool:
        if await self._is_member(subject.id, object.id):
            return True
        return False

    async def _is_member(self, user_id: UUID, organization_id: UUID) -> bool:
        key = (user_id, organization_id)
        if key in self._cache_is_member:
            return self._cache_is_member[key]

        memberships = await user_organization_service.list_by_user_id(
            self.session, user_id
        )

        for m in memberships:
            if m.organization_id == organization_id:
                self._cache_is_member[key] = True
                return True

        self._cache_is_member[key] = False
        return False

    #
    # Account
    #

    def _can_user_read_account(self, subject: User, object: Account) -> bool:
        if subject.id == object.admin_id:
            return True

        return False

    def _can_user_write_account(self, subject: User, object: Account) -> bool:
        if subject.id == object.admin_id:
            return True

        return False

    #
    # IssueReward
    #

    async def _can_user_read_issue_reward(
        self, subject: User, object: IssueReward
    ) -> bool:
        # If rewarded to this user
        if object.user_id and object.user_id == subject.id:
            return True

        # If member of rewarded org
        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    #
    # Pledge
    #

    async def _can_anonymous_read_pledge(self, object: Pledge) -> bool:
        return False

    async def _can_user_read_pledge(self, subject: User, object: Pledge) -> bool:
        # If pledged by this user
        if object.by_user_id and object.by_user_id == subject.id:
            return True

        # If member of pledging org
        if object.by_organization_id and await self._is_member(
            subject.id, object.by_organization_id
        ):
            return True

        return False

    async def _can_user_write_pledge(self, subject: User, object: Pledge) -> bool:
        # If pledged by this user
        if object.by_user_id and object.by_user_id == subject.id:
            return True

        # If member of pledging org
        if object.by_organization_id and await self._is_member(
            subject.id, object.by_organization_id
        ):
            return True

        return False
