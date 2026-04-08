from __future__ import annotations

import uuid

from sqlalchemy.orm.strategy_options import joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.enums import PayoutAccountType
from polar.exceptions import PolarError
from polar.models import Account, Organization, User
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
        repository = AccountRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(Account.id == id)
            .options(
                joinedload(Account.users),
                joinedload(Account.organizations),
            )
        )
        account = await repository.get_one_or_none(statement)

        return account

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
                # Fields to remove
                account_type=PayoutAccountType.manual,
                country="XX",
                is_details_submitted=True,
                is_charges_enabled=True,
                is_payouts_enabled=True,
            )
        )

    async def update(
        self, session: AsyncSession, account: Account, account_update: AccountUpdate
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account, update_dict=account_update.model_dump(exclude_unset=True)
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
