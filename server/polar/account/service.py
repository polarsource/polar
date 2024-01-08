from __future__ import annotations

from collections.abc import Sequence
from uuid import UUID

import stripe as stripe_lib
import stripe.error as stripe_lib_error
import structlog
from sqlalchemy import Select, and_, select
from sqlalchemy.orm import joinedload

from polar.enums import AccountType
from polar.exceptions import PolarError
from polar.integrations.open_collective.service import (
    CollectiveNotFoundError,
    OpenCollectiveAPIError,
    open_collective,
)
from polar.integrations.stripe.service import stripe
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.services import ResourceService
from polar.models import Account, Organization, User
from polar.postgres import AsyncSession

from .schemas import AccountCreate, AccountLink, AccountUpdate

log = structlog.get_logger()


class AccountServiceError(PolarError):
    pass


class AccountAlreadyExistsError(AccountServiceError):
    def __init__(self) -> None:
        super().__init__("An account already exists for this organization.")


class AccountDoesNotExist(AccountServiceError):
    def __init__(self, external_id: str) -> None:
        self.external_id = external_id
        message = f"No associated account exists with external ID {external_id}"
        super().__init__(message)


class AccountService(ResourceService[Account, AccountCreate, AccountUpdate]):
    async def search(
        self, session: AsyncSession, user: User, *, pagination: PaginationParams
    ) -> tuple[Sequence[Account], int]:
        statement = self._get_readable_accounts_statement(user)

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def get_by_user_id(
        self, session: AsyncSession, user_id: UUID
    ) -> Account | None:
        statement = select(Account).join(
            User,
            onclause=and_(
                User.account_id == Account.id,
                User.id == user_id,
            ),
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_by_organization_id(
        self, session: AsyncSession, organization_id: UUID
    ) -> Account | None:
        statement = select(Account).join(
            Organization,
            onclause=and_(
                Organization.account_id == Account.id,
                Organization.id == organization_id,
            ),
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_by_id(self, session: AsyncSession, id: UUID) -> Account | None:
        statement = (
            select(Account)
            .where(Account.id == id)
            .options(joinedload(Account.users), joinedload(Account.organizations))
        )
        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def get_by_stripe_id(
        self, session: AsyncSession, stripe_id: str
    ) -> Account | None:
        return await self.get_by(session=session, stripe_id=stripe_id)

    async def create_account(
        self,
        session: AsyncSession,
        *,
        admin_id: UUID,
        account_create: AccountCreate,
    ) -> Account:
        if account_create.account_type == AccountType.stripe:
            account = await self._create_stripe_account(
                session, admin_id, account_create
            )
        elif account_create.account_type == AccountType.open_collective:
            account = await self._create_open_collective_account(
                session, admin_id, account_create
            )
        else:
            raise AccountServiceError("Unknown account type")

        print(account.users)
        return account

    async def _build_stripe_account_name(
        self, session: AsyncSession, account: Account
    ) -> str | None:
        # The account name is visible for users and is used to differentiate accounts
        # from the same Platform ("Polar") in Stripe Express.
        await session.refresh(account, {"users", "organizations"})
        associations = []
        for user in account.users:
            associations.append(f"user/{user.username}")
        for organization in account.organizations:
            associations.append(f"org/{organization.name}")
        return "·".join(associations)

    async def _create_stripe_account(
        self, session: AsyncSession, admin_id: UUID, account: AccountCreate
    ) -> Account:
        try:
            stripe_account = stripe.create_account(account, name=None)  # TODO: name
        except stripe_lib_error.StripeError as e:
            if e.user_message:
                raise AccountServiceError(e.user_message) from e
            else:
                raise AccountServiceError("An unexpected Stripe error happened") from e

        return await Account.create(
            session=session,
            status=Account.Status.ONBOARDING_STARTED,
            admin_id=admin_id,
            account_type=account.account_type,
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

    async def _create_open_collective_account(
        self, session: AsyncSession, admin_id: UUID, account: AccountCreate
    ) -> Account:
        assert account.open_collective_slug is not None
        try:
            collective = await open_collective.get_collective(
                account.open_collective_slug
            )
        except OpenCollectiveAPIError as e:
            raise AccountServiceError(e.message) from e
        except CollectiveNotFoundError as e:
            raise AccountServiceError(e.message) from e

        if not collective.is_eligible:
            raise AccountServiceError(
                "This collective is not eligible to receive payouts. "
                "You can use Stripe instead."
            )

        return await Account.create(
            session=session,
            status=Account.Status.UNREVIEWED,
            admin_id=admin_id,
            account_type=account.account_type,
            open_collective_slug=account.open_collective_slug,
            email=None,
            country=account.country,
            users=[],
            organizations=[],
            # For now, hard-code those values
            currency="usd",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            business_type="fiscal_host",
            data={},
        )

    async def update_account_from_stripe(
        self, session: AsyncSession, *, stripe_account: stripe_lib.Account
    ) -> Account:
        account = await self.get_by_stripe_id(session, stripe_account.id)
        if account is None:
            raise AccountDoesNotExist(stripe_account.id)

        account.email = stripe_account.email
        account.country = stripe_account.country
        account.currency = stripe_account.default_currency
        account.is_details_submitted = stripe_account.details_submitted or False
        account.is_charges_enabled = stripe_account.charges_enabled or False
        account.is_payouts_enabled = stripe_account.payouts_enabled or False
        account.data = stripe_account.to_dict()

        if all(
            (
                account.currency is not None,
                account.is_details_submitted,
                account.is_charges_enabled,
                account.is_payouts_enabled,
            )
        ):
            account.status = Account.Status.UNREVIEWED

        session.add(account)
        await session.commit()

        return account

    async def onboarding_link(
        self, account: Account, return_path: str
    ) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_account_link(account.stripe_id, return_path)
            return AccountLink(url=account_link.url)

        return None

    async def dashboard_link(self, account: Account) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_login_link(account.stripe_id)
            return AccountLink(url=account_link.url)

        elif account.account_type == AccountType.open_collective:
            assert account.open_collective_slug is not None
            dashboard_link = open_collective.create_dashboard_link(
                account.open_collective_slug
            )
            return AccountLink(url=dashboard_link)

        return None

    def get_balance(
        self,
        account: Account,
    ) -> tuple[str, int] | None:
        if account.account_type != AccountType.stripe:
            return None
        assert account.stripe_id is not None
        return stripe.retrieve_balance(account.stripe_id)

    async def sync_to_upstream(self, session: AsyncSession, account: Account) -> None:
        name = await self._build_stripe_account_name(session, account)

        if account.account_type == AccountType.stripe and account.stripe_id:
            stripe.update_account(account.stripe_id, name)

    def _get_readable_accounts_statement(self, user: User) -> Select[tuple[Account]]:
        statement = (
            select(Account).options(
                joinedload(Account.organizations), joinedload(Account.users)
            )
        ).where(Account.admin_id == user.id, Account.deleted_at.is_(None))

        return statement


account = AccountService(Account)
