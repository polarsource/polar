from __future__ import annotations
from typing import Tuple
from uuid import UUID

import stripe.error as stripe_lib_error
import structlog

from polar.models.user import User
from .schemas import AccountCreate, AccountLink, AccountUpdate


from polar.kit.services import ResourceService
from polar.models.account import Account
from polar.postgres import AsyncSession
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe
from polar.integrations.open_collective.service import (
    open_collective,
    OpenCollectiveAPIError,
    CollectiveNotFoundError,
)


log = structlog.get_logger()


class AccountServiceError(Exception):
    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


class AccountAlreadyExistsError(AccountServiceError):
    def __init__(self) -> None:
        super().__init__("An account already exists for this organization.")


class AccountService(ResourceService[Account, AccountCreate, AccountUpdate]):
    async def create_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account:
        existing = await self.get_by(session=session, organization_id=organization_id)
        if existing is not None:
            raise AccountAlreadyExistsError()

        if account.account_type == AccountType.stripe:
            return await self._create_stripe_account(
                session, organization_id, admin_id, account
            )
        elif account.account_type == AccountType.open_collective:
            return await self._create_open_collective_account(
                session, organization_id, admin_id, account
            )

        raise AccountServiceError("Unknown account type")

    async def _create_stripe_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account:
        try:
            stripe_account = stripe.create_account(account)
        except stripe_lib_error.StripeError as e:
            raise AccountServiceError(e.user_message) from e

        return await Account.create(
            session=session,
            organization_id=organization_id,
            admin_id=admin_id,
            account_type=account.account_type,
            stripe_id=stripe_account.stripe_id,
            email=stripe_account.email,
            country=stripe_account.country,
            currency=stripe_account.default_currency,
            is_details_submitted=stripe_account.details_submitted,
            is_charges_enabled=stripe_account.charges_enabled,
            is_payouts_enabled=stripe_account.payouts_enabled,
            business_type=stripe_account.business_type,
            data=stripe_account.to_dict(),
        )

    async def _create_open_collective_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
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
                "This collective is not eligible to receive payouts. You can use Stripe instead."
            )

        return await Account.create(
            session=session,
            organization_id=organization_id,
            admin_id=admin_id,
            account_type=account.account_type,
            open_collective_slug=account.open_collective_slug,
            email=None,
            country=account.country,
            # For now, hard-code those values
            currency="USD",
            is_details_submitted=True,
            is_charges_enabled=True,
            is_payouts_enabled=True,
            business_type="fiscal_host",
            data={},
        )

    async def onboarding_link_for_user(
        self, account: Account, user: User, appendix: str | None = None
    ) -> AccountLink | None:
        if account.admin_id != user.id:
            # TODO: Error?
            return None

        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_account_link(account.stripe_id, appendix)
            return AccountLink(**account_link)

        return None

    async def dashboard_link(self, account: Account) -> AccountLink | None:
        if account.account_type == AccountType.stripe:
            assert account.stripe_id is not None
            account_link = stripe.create_login_link(account.stripe_id)
            return AccountLink(**account_link)
        elif account.account_type == AccountType.open_collective:
            assert account.open_collective_slug is not None
            dashboard_link = open_collective.create_dashboard_link(
                account.open_collective_slug
            )
            return AccountLink(created=1, url=dashboard_link)

        return None

    def get_balance(
        self,
        account: Account,
    ) -> Tuple[str, int] | None:
        if account.account_type != AccountType.stripe:
            return None
        assert account.stripe_id is not None
        return stripe.retrieve_balance(account.stripe_id)

    def transfer(
        self, session: AsyncSession, account: Account, amount: int, transfer_group: str
    ) -> str | None:
        if account.account_type != AccountType.stripe:
            return None
        assert account.stripe_id is not None
        transfer = stripe.transfer(
            destination_stripe_id=account.stripe_id,
            amount=amount,
            transfer_group=transfer_group,
        )
        return transfer.stripe_id


account = AccountService(Account)
