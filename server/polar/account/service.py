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
from polar.models.transaction import TransactionType
from polar.postgres import AsyncSession
from polar.transaction.service.transaction import transaction as transaction_service

from .schemas import AccountCreate, AccountLink, AccountUpdate


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


class AccountService:
    async def search(
        self,
        session: AsyncSession,
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
        session: AsyncSession,
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

    async def create_account(
        self,
        session: AsyncSession,
        *,
        admin: User,
        account_create: AccountCreate,
    ) -> Account:
        assert account_create.account_type == AccountType.stripe
        account = await self._create_stripe_account(session, admin, account_create)
        await loops_service.user_created_account(
            session, admin, accountType=account.account_type
        )
        return account

    async def check_review_threshold(
        self, session: AsyncSession, account: Account
    ) -> Account:
        if account.is_under_review():
            return account

        transfers_sum = await transaction_service.get_transactions_sum(
            session, account.id, type=TransactionType.balance
        )
        if (
            account.next_review_threshold is not None
            and transfers_sum >= account.next_review_threshold
        ):
            account.status = Account.Status.UNDER_REVIEW
            session.add(account)

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
        self, session: AsyncSession, admin: User, account_create: AccountCreate
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
        name = await self._build_stripe_account_name(session, account)

        if account.account_type == AccountType.stripe and account.stripe_id:
            await stripe.update_account(account.stripe_id, name)

    async def deny_account(self, session: AsyncSession, account: Account) -> Account:
        account.status = Account.Status.DENIED
        session.add(account)
        return account


account = AccountService()
