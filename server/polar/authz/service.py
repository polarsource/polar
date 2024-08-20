from enum import StrEnum
from typing import Self
from uuid import UUID

from fastapi import Depends
from sqlalchemy.orm import joinedload

from polar.auth.models import Anonymous, Subject
from polar.external_organization.service import (
    external_organization as external_organization_service,
)
from polar.issue.service import issue as issue_service
from polar.models.account import Account
from polar.models.article import Article
from polar.models.benefit import Benefit
from polar.models.downloadable import Downloadable, DownloadableStatus
from polar.models.external_organization import ExternalOrganization
from polar.models.issue import Issue
from polar.models.issue_reward import IssueReward
from polar.models.license_key import LicenseKey
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.product import Product
from polar.models.repository import Repository
from polar.models.subscription import Subscription
from polar.models.user import User
from polar.models.webhook_endpoint import WebhookEndpoint
from polar.postgres import AsyncSession, get_db_session
from polar.repository.service import repository as repository_service
from polar.user_organization.service import (
    user_organization as user_organization_service,
)


class AccessType(StrEnum):
    read = "read"
    write = "write"


Object = (
    User
    | Organization
    | Account
    | ExternalOrganization
    | Repository
    | IssueReward
    | Issue
    | Pledge
    | Product
    | Benefit
    | Subscription
    | Article
    | WebhookEndpoint
    | Downloadable
    | LicenseKey
)


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
        # ExternalOrganization
        #

        if (
            isinstance(subject, Organization)
            and isinstance(object, ExternalOrganization)
            and subject.id == object.organization_id
        ):
            return True

        if accessType == AccessType.read and isinstance(object, ExternalOrganization):
            return True

        if (
            isinstance(subject, User)
            and accessType == AccessType.write
            and isinstance(object, ExternalOrganization)
        ):
            return await self._can_user_write_external_organization_id(
                subject, object.id
            )

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

        if isinstance(subject, Organization) and isinstance(object, Repository):
            return object.organization_id == subject.id

        if (
            isinstance(subject, Anonymous)
            and accessType == AccessType.read
            and isinstance(object, Repository)
        ):
            return self._can_anonymous_read_repository(object)

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
        # Benefit
        #
        if isinstance(object, Benefit) and accessType == AccessType.write:
            if isinstance(subject, User):
                return await self._can_user_write_organization(
                    subject, object.organization
                )
            if isinstance(subject, Organization):
                return object.organization_id == subject.id

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

        #
        # WebhookEndpoint
        #

        if accessType == AccessType.write and isinstance(object, WebhookEndpoint):
            if isinstance(subject, User):
                return await self._can_user_write_webhook_endpoint(subject, object)
            if isinstance(subject, Organization):
                return object.organization_id == subject.id

        #
        # Downloadable
        #

        if (
            isinstance(subject, User)
            and accessType == AccessType.read
            and isinstance(object, Downloadable)
        ):
            return await self._can_user_download_file(subject, object)
        #
        # License Key
        #
        if isinstance(object, LicenseKey):
            if isinstance(subject, User):
                if subject.id == object.user_id:
                    return True

                is_member = await self._is_member(
                    subject.id, object.benefit.organization_id
                )
                return is_member

            if isinstance(subject, Organization):
                return object.benefit.organization_id == subject.id

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
        key = (subject.id, object.id)
        if self._can_anonymous_read_repository(object):
            self._cache_can_user_read_repository_id[key] = True
            return True

        res = await self._can_user_read_external_organization_id(
            subject, object.organization_id
        )
        self._cache_can_user_read_repository_id[key] = res
        return res

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

        return await self._can_user_read_repository(subject, repo)

    async def _can_user_write_repository(
        self, subject: User, object: Repository
    ) -> bool:
        return await self._can_user_write_external_organization_id(
            subject, object.organization_id
        )

    #
    # ExternalOrganization
    #
    async def _get_linked_organization_from_external_organization(
        self, external_organization_id: UUID
    ) -> Organization | None:
        external_organization = await external_organization_service.get(
            self.session,
            external_organization_id,
            options=(joinedload(ExternalOrganization.organization),),
        )

        if external_organization is None:
            return None

        return external_organization.organization

    async def _can_user_read_external_organization_id(
        self, subject: User, external_organization_id: UUID
    ) -> bool:
        organization = await self._get_linked_organization_from_external_organization(
            external_organization_id
        )

        if organization is None:
            return False

        return await self._is_member(subject.id, organization.id)

    async def _can_user_write_external_organization_id(
        self, subject: User, external_organization_id: UUID
    ) -> bool:
        organization = await self._get_linked_organization_from_external_organization(
            external_organization_id
        )

        if organization is None:
            return False

        return await self._can_user_write_organization(subject, organization)

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

        # If member of receiving linked org
        if (
            object.organization_id
            and await self._can_user_write_external_organization_id(
                subject, object.organization_id
            )
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

        # If member of receiving linked org
        if (
            object.organization_id
            and await self._can_user_write_external_organization_id(
                subject, object.organization_id
            )
        ):
            return True

        return False

    #
    # Article
    #
    async def _can_user_write_article(self, subject: User, object: Article) -> bool:
        # If member of org
        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False

    #
    # Downloadable
    #
    async def _can_user_download_file(
        self, subject: User, object: Downloadable
    ) -> bool:
        if subject.id != object.user_id:
            return False

        return object.status == DownloadableStatus.granted.value

    #
    # WebhookEndpoint
    #
    async def _can_user_write_webhook_endpoint(
        self, subject: User, object: WebhookEndpoint
    ) -> bool:
        # if owned by user
        if object.user_id and object.user_id == subject.id:
            return True

        # If member of org
        if object.organization_id and await self._is_member(
            subject.id, object.organization_id
        ):
            return True

        return False
