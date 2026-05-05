from __future__ import annotations

import uuid

from sqlalchemy.orm.strategy_options import joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.authz.service import get_accessible_org_ids
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.exceptions import PolarError
from polar.member.repository import MemberRepository
from polar.member.service import member_service
from polar.models import Account, Organization, User
from polar.models.member import MemberRole
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.user.repository import UserRepository

from .schemas import AccountUpdate


class AccountServiceError(PolarError):
    pass


class CannotChangeAdminError(AccountServiceError):
    def __init__(self, reason: str) -> None:
        super().__init__(f"Cannot change account admin: {reason}")


class UserNotOrganizationMemberError(AccountServiceError):
    def __init__(self, user_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"User {user_id} is not a member of organization {organization_id}"
        )


class AccountService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        id: uuid.UUID,
    ) -> Account | None:
        org_ids = await get_accessible_org_ids(session, auth_subject)
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_statement_by_org_ids(org_ids)
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        return await repository.get_one_or_none(statement)

    async def get_by_organization(
        self,
        session: AsyncReadSession,
        organization_id: uuid.UUID,
    ) -> Account | None:
        repository = AccountRepository.from_session(session)
        return await repository.get_by_organization(organization_id)

    async def is_user_admin(
        self, session: AsyncReadSession, account_id: uuid.UUID, user: User
    ) -> bool:
        account = await self._get_unrestricted(session, account_id)
        if account is None:
            return False
        return account.admin_id == user.id

    async def create(self, session: AsyncSession, admin: User) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.create(
            Account(
                currency="usd",  # FIXME: main Polar currency
                admin=admin,
            )
        )

    async def update(
        self, session: AsyncSession, account: Account, account_update: AccountUpdate
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account, update_dict=account_update.model_dump(exclude_unset=True)
        )

    async def set_platform_fee(
        self,
        session: AsyncSession,
        account: Account,
        *,
        fee_percent: int | None,
        fee_fixed: int | None,
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account,
            update_dict={
                "_platform_fee_percent": fee_percent,
                "_platform_fee_fixed": fee_fixed,
            },
        )

    async def _sync_polar_self_customer_owner(
        self,
        session: AsyncSession,
        *,
        organization_id: uuid.UUID,
        new_admin_user: User,
    ) -> None:
        if not settings.POLAR_SELF_ENABLED:
            return

        polar_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
        customer_repository = CustomerRepository.from_session(session)
        customer = await customer_repository.get_by_external_id_and_organization(
            str(organization_id), polar_organization_id
        )
        if customer is None:
            raise CannotChangeAdminError(
                f"Polar self customer not found for organization {organization_id}"
            )

        member_repository = MemberRepository.from_session(session)
        target_member = await member_repository.get_by_customer_id_and_external_id(
            customer.id, str(new_admin_user.id)
        )
        if target_member is None:
            raise CannotChangeAdminError(
                f"Polar self member not found for user {new_admin_user.id}"
            )

        if target_member.role != MemberRole.owner:
            await member_service.update(
                session,
                target_member,
                role=MemberRole.owner,
                allow_ownership_transfer=True,
            )

    async def change_admin(
        self,
        session: AsyncSession,
        account: Account,
        new_admin_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Account:
        user_repository = UserRepository.from_session(session)
        is_member = await user_repository.is_organization_member(
            new_admin_id, organization_id
        )

        if not is_member:
            raise UserNotOrganizationMemberError(new_admin_id, organization_id)

        new_admin_user = await user_repository.get_by_id(new_admin_id)

        if new_admin_user is None:
            raise UserNotOrganizationMemberError(new_admin_id, organization_id)

        if (
            new_admin_user.identity_verification_status
            != IdentityVerificationStatus.verified
        ):
            raise CannotChangeAdminError(
                f"New admin must be verified in Stripe. Current status: {new_admin_user.identity_verification_status.get_display_name()}"
            )

        if account.admin_id == new_admin_id:
            raise CannotChangeAdminError("New admin is the same as current admin")

        repository = AccountRepository.from_session(session)
        account = await repository.update(
            account, update_dict={"admin_id": new_admin_id}
        )
        await self._sync_polar_self_customer_owner(
            session,
            organization_id=organization_id,
            new_admin_user=new_admin_user,
        )

        return account

    async def _get_unrestricted(
        self,
        session: AsyncReadSession,
        id: uuid.UUID,
    ) -> Account | None:
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_base_statement()
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        return await repository.get_one_or_none(statement)


account = AccountService()
