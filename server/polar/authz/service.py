from enum import Enum
from typing import Self
from uuid import UUID

from fastapi import Depends

from polar.issue.service import issue as issue_service
from polar.models.account import Account
from polar.models.article import Article
from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.subscription import Subscription
from polar.models.subscription_benefit import SubscriptionBenefit
from polar.models.subscription_tier import SubscriptionTier
from polar.models.user import User
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


class Anonymous:
    ...


Subject = User | Anonymous


class AccessType(str, Enum):
    read = "read"
    write = "write"


Object = (
    User
    | Organization
    | Repository
    | Account
    | IssueReward
    | Issue
    | Pledge
    | SubscriptionTier
    | SubscriptionBenefit
    | Subscription
    | Article
)


class Authz:
    session: AsyncSession

    # request scoped caches
    _cache_can_user_read_repository_id: dict[tuple[UUID, UUID], bool]
    _cache_is_member: dict[tuple[UUID, UUID], bool]
    _cache_is_member_and_admin: dict[tuple[UUID, UUID], bool]

    def __init__(self, session: AsyncSession):
        self.session = session
        self._cache_can_user_read_repository_id = {}
        self._cache_is_member = {}
        self._cache_is_member_and_admin = {}

    @classmethod
    async def authz(cls, session: AsyncSession = Depends(get_db_session)) -> Self:
        return cls(session=session)

    async def can(
        self, subject: Subject, accessType: AccessType, object: Object
    ) -> bool:
        # Anoymous users can only read
        if (isinstance(subject, Anonymous)) and accessType != AccessType.read:
            return False

        #
        # Repository
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Repository)
        ):
            return await self._can_user_read_repository(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Repository)
        ):
            return await self._can_user_write_repository(subject, object)

        if (
            isinstance(subject, Anonymous)
            and accessType == AccessType.read
            and isinstance(object, Repository)
        ):
            return self._can_anonymous_read_repository(object)

        #
        # Organization
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Organization)
        ):
            return await self._can_user_write_organization(subject, object)

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
        # Issue
        #
        if (
            isinstance(subject, Anonymous)
            and accessType == AccessType.read
            and isinstance(object, Issue)
        ):
            return await self._can_anonymous_read_issue(object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Issue)
        ):
            return await self._can_user_read_issue(subject, object)

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Issue)
        ):
            return await self._can_user_write_issue(subject, object)

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
        # SubscriptionTier / SubscriptionBenefit
        #
        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, SubscriptionTier | SubscriptionBenefit)
        ):
            if object.organization:
                return await self._can_user_write_organization(
                    subject, object.organization
                )
            if object.repository:
                return await self._can_user_write_repository(subject, object.repository)

        #
        # Subscription
        #
        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Subscription)
        ):
            return object.user_id == subject.id

        #
        # Article
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, Article)
        ):
            return await self._can_user_write_article(subject, object)

        raise Exception(
            f"Unknown subject/action/object combination. subject={type(subject)} access={accessType} object={type(object)}"  # noqa: E501
        )

    #
    # Repository
    #

    def _can_anonymous_read_repository(self, object: Repository) -> bool:
        if object.is_private is False:
            return True
        return False

    async def _can_user_read_repository(
        self, subject: User, object: Repository
    ) -> bool:
        if self._can_anonymous_read_repository(object):
            return True

        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    async def _can_user_read_repository_id(
        self, subject: User, repository_id: UUID
    ) -> bool:
        key = (subject.id, repository_id)

        if key in self._cache_can_user_read_repository_id:
            return self._cache_can_user_read_repository_id[key]

        repo = await repository_service.get(self.session, repository_id)
        if not repo:
            self._cache_can_user_read_repository_id[key] = False
            return False

        res = await self._can_user_read_repository(subject, repo)
        self._cache_can_user_read_repository_id[key] = res
        return res

    async def _can_user_write_repository(
        self, subject: User, object: Repository
    ) -> bool:
        if object.organization_id and await self._is_member_and_admin(
            subject.id, object.organization_id
        ):
            return True
        return False

    #
    # Organization
    #

    async def _can_user_write_organization(
        self, subject: User, object: Organization
    ) -> bool:
        if await self._is_member_and_admin(subject.id, object.id):
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

    async def _is_member_and_admin(self, user_id: UUID, organization_id: UUID) -> bool:
        key = (user_id, organization_id)
        if key in self._cache_is_member_and_admin:
            return self._cache_is_member_and_admin[key]

        memberships = await user_organization_service.list_by_user_id(
            self.session, user_id
        )

        for m in memberships:
            if m.organization_id == organization_id and m.is_admin:
                self._cache_is_member_and_admin[key] = True
                return True

        self._cache_is_member_and_admin[key] = False
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
    # Issue
    #
    async def _can_anonymous_read_issue(self, object: Issue) -> bool:
        repo = await repository_service.get(self.session, object.repository_id)
        if not repo:
            return False

        if self._can_anonymous_read_repository(repo):
            return True

        return False

    async def _can_user_read_issue(self, subject: User, object: Issue) -> bool:
        if await self._can_user_read_repository_id(
            subject,
            object.repository_id,
        ):
            return True

        return False

    async def _can_user_write_issue(self, subject: User, object: Issue) -> bool:
        repo = await repository_service.get(self.session, object.repository_id)
        if not repo:
            return False

        if await self._can_user_write_repository(
            subject,
            repo,
        ):
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

        # Can read reward if can write issue
        issue = await issue_service.get(self.session, object.issue_id)
        if issue and await self._can_user_write_issue(subject, issue):
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

        # If member of receiving org
        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    async def _can_user_write_pledge(self, subject: User, object: Pledge) -> bool:
        # If pledged by this user
        if object.by_user_id and object.by_user_id == subject.id:
            return True

        # If admin of pledging org
        if object.by_organization_id and await self._is_member_and_admin(
            subject.id, object.by_organization_id
        ):
            return True

        # If admin of receiving org
        if object.organization_id and await self._is_member_and_admin(
            subject.id, object.organization_id
        ):
            return True

        return False

    #
    # Article
    #
    async def _can_user_write_article(self, subject: User, object: Article) -> bool:
        # If member and admin of org
        if object.organization_id and await self._is_member_and_admin(
            subject.id, object.organization_id
        ):
            return True

        return False
