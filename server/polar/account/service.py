from __future__ import annotations

import uuid
from collections.abc import Sequence

import stripe as stripe_lib
from sqlalchemy.orm.strategy_options import joinedload

from polar.account.repository import AccountRepository
from polar.auth.models import AuthSubject
from polar.campaign.service import campaign as campaign_service
from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.open_collective.service import open_collective
from polar.integrations.stripe.service import stripe
from polar.kit.pagination import PaginationParams
from polar.models import Account, Organization, User
from polar.models.user import IdentityVerificationStatus
from polar.postgres import AsyncReadSession, AsyncSession
from polar.user.repository import UserRepository

from .schemas import (
    AccountCreateForOrganization,
    AccountLink,
    AccountUpdate,
)


class AccountServiceError(PolarError):
    pass


class AccountAlreadyExistsError(AccountServiceError):
    def __init__(self) -> None:
        super().__init__("An account already exists for this organization.")


class AccountExternalIdDoesNotExist(AccountServiceError):
    def __init__(self, external_id: str) -> None:
        self.external_id = external_id
        message = f"No associated account exists with external ID {external_id}"
        super().__init__(message)


class CannotChangeAdminError(AccountServiceError):
    def __init__(self, reason: str) -> None:
        super().__init__(f"Cannot change account admin: {reason}")


class UserNotOrganizationMemberError(AccountServiceError):
    def __init__(self, user_id: uuid.UUID, organization_id: uuid.UUID) -> None:
        super().__init__(
            f"User {user_id} is not a member of organization {organization_id}"
        )


class AccountService:
    async def search(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User],
        *,
        pagination: PaginationParams,
    ) -> tuple[Sequence[Account], int]:
        repository = AccountRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).options(
            joinedload(Account.users),
            joinedload(Account.organizations),
        )
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

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
        return await repository.get_one_or_none(statement)

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

    async def is_user_admin(
        self, session: AsyncReadSession, account_id: uuid.UUID, user: User
    ) -> bool:
        account = await self._get_unrestricted(session, account_id)
        if account is None:
            return False
        return account.admin_id == user.id

    async def update(
        self, session: AsyncSession, account: Account, account_update: AccountUpdate
    ) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.update(
            account, update_dict=account_update.model_dump(exclude_unset=True)
        )

    async def delete(self, session: AsyncSession, account: Account) -> Account:
        repository = AccountRepository.from_session(session)
        return await repository.soft_delete(account)

    async def delete_stripe_account(
        self, session: AsyncSession, account: Account
    ) -> None:
        """Delete Stripe account and clear related database fields."""
        if not account.stripe_id:
            raise AccountServiceError("Account does not have a Stripe ID")

        # Verify the account exists on Stripe before deletion
        if not await stripe.account_exists(account.stripe_id):
            raise AccountServiceError(
                f"Stripe Account ID {account.stripe_id} doesn't exist"
            )

        # Delete the account on Stripe
        await stripe.delete_account(account.stripe_id)

        # Clear Stripe account data from database
        account.stripe_id = None
        account.is_details_submitted = False
        account.is_charges_enabled = False
        account.is_payouts_enabled = False
        session.add(account)

    async def create_account(
        self,
        session: AsyncSession,
        *,
        admin: User,
        account_create: AccountCreateForOrganization,
    ) -> Account:
        assert account_create.account_type == AccountType.stripe
        account = await self._create_stripe_account(session, admin, account_create)
        await loops_service.user_created_account(
            session, admin, accountType=account.account_type
        )
        return account

    async def get_or_create_account_for_organization(
        self,
        session: AsyncSession,
        organization: Organization,
        admin: User,
        account_create: AccountCreateForOrganization,
    ) -> Account:
        """Get existing account for organization or create a new one.

        If organization already has an account:
        - If account has no stripe_id (deleted), create new Stripe account
        - Otherwise return existing account

        If organization has no account, create new one and link it.
        """

        # Check if organization already has an account
        if organization.account_id:
            repository = AccountRepository.from_session(session)
            account = await repository.get_by_id(
                organization.account_id,
                options=(
                    joinedload(Account.users),
                    joinedload(Account.organizations),
                ),
            )

            if account and not account.stripe_id:
                assert account_create.account_type == AccountType.stripe
                try:
                    stripe_account = await stripe.create_account(
                        account_create, name=None
                    )
                except stripe_lib.StripeError as e:
                    if e.user_message:
                        raise AccountServiceError(e.user_message) from e
                    else:
                        raise AccountServiceError(
                            "An unexpected Stripe error happened"
                        ) from e

                # Update account with new Stripe details
                account.stripe_id = stripe_account.id
                account.email = stripe_account.email
                if stripe_account.country is not None:
                    account.country = stripe_account.country
                assert stripe_account.default_currency is not None
                account.currency = stripe_account.default_currency
                account.is_details_submitted = stripe_account.details_submitted or False
                account.is_charges_enabled = stripe_account.charges_enabled or False
                account.is_payouts_enabled = stripe_account.payouts_enabled or False
                account.business_type = stripe_account.business_type
                account.data = stripe_account.to_dict()

                session.add(account)

                await loops_service.user_created_account(
                    session, admin, accountType=account.account_type
                )

                return account
            elif account:
                return account

        # No account exists, create new one
        account = await self.create_account(
            session, admin=admin, account_create=account_create
        )

        # Link account to organization. Import happens here to avoid circular dependency
        from polar.organization.service import organization as organization_service

        await organization_service.set_account(
            session,
            auth_subject=AuthSubject(subject=admin, scopes=set(), session=None),
            organization=organization,
            account_id=account.id,
        )

        await session.refresh(account, {"users", "organizations"})

        return account

    async def _build_stripe_account_name(
        self, session: AsyncSession, account: Account
    ) -> str | None:
        # The account name is visible for users and is used to differentiate accounts
        # from the same Platform ("Polar") in Stripe Express.
        await session.refresh(account, {"users", "organizations"})
        associations = []
        for user in account.users:
            associations.append(f"user/{user.email}")
        for organization in account.organizations:
            associations.append(f"org/{organization.slug}")
        return "·".join(associations)

    async def _create_stripe_account(
        self,
        session: AsyncSession,
        admin: User,
        account_create: AccountCreateForOrganization,
    ) -> Account:
        try:
            stripe_account = await stripe.create_account(
                account_create, name=None
            )  # TODO: name
        except stripe_lib.StripeError as e:
            if e.user_message:
                raise AccountServiceError(e.user_message) from e
            else:
                raise AccountServiceError("An unexpected Stripe error happened") from e

        account = Account(
            status=Account.Status.ONBOARDING_STARTED,
            admin_id=admin.id,
            account_type=account_create.account_type,
            stripe_id=stripe_account.id,
            email=stripe_account.email,
            country=stripe_account.country,
            currency=stripe_account.default_currency,
            is_details_submitted=stripe_account.details_submitted,
            is_charges_enabled=stripe_account.charges_enabled,
            is_payouts_enabled=stripe_account.payouts_enabled,
            business_type=stripe_account.business_type,
            data=stripe_account.to_dict(),
            users=[],
            organizations=[],
        )

        campaign = await campaign_service.get_eligible(session, admin)
        if campaign:
            account.campaign_id = campaign.id
            account._platform_fee_percent = campaign.fee_percent
            account._platform_fee_fixed = campaign.fee_fixed

        session.add(account)
        await session.flush()
        return account

    async def update_account_from_stripe(
        self, session: AsyncSession, *, stripe_account: stripe_lib.Account
    ) -> Account:
        repository = AccountRepository.from_session(session)
        account = await repository.get_by_stripe_id(stripe_account.id)
        if account is None:
            raise AccountExternalIdDoesNotExist(stripe_account.id)

        account.email = stripe_account.email
        assert stripe_account.default_currency is not None
        account.currency = stripe_account.default_currency
        account.is_details_submitted = stripe_account.details_submitted or False
        account.is_charges_enabled = stripe_account.charges_enabled or False
        account.is_payouts_enabled = stripe_account.payouts_enabled or False
        if stripe_account.country is not None:
            account.country = stripe_account.country
        account.data = stripe_account.to_dict()

        session.add(account)

        # Update organization status based on Stripe account capabilities
        # Import here to avoid circular imports
        from polar.organization.service import organization as organization_service

        await organization_service.update_status_from_stripe_account(session, account)

        return account

    async def onboarding_link(
        self, account: Account, return_path: str
    ) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = await stripe.create_account_link(
                account.stripe_id, return_path
            )
            return AccountLink(url=account_link.url)

        return None

    async def dashboard_link(self, account: Account) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = await stripe.create_login_link(account.stripe_id)
            return AccountLink(url=account_link.url)

        elif account.account_type == AccountType.open_collective:
            assert account.open_collective_slug is not None
            dashboard_link = open_collective.create_dashboard_link(
                account.open_collective_slug
            )
            return AccountLink(url=dashboard_link)

        return None

    async def sync_to_upstream(self, session: AsyncSession, account: Account) -> None:
        if account.account_type != AccountType.stripe:
            return

        if not account.stripe_id:
            return

        name = await self._build_stripe_account_name(session, account)
        await stripe.update_account(account.stripe_id, name)

    async def change_admin(
        self,
        session: AsyncSession,
        account: Account,
        new_admin_id: uuid.UUID,
        organization_id: uuid.UUID,
    ) -> Account:
        if account.stripe_id:
            raise CannotChangeAdminError(
                "Stripe account must be deleted before changing admin"
            )

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


account = AccountService()
