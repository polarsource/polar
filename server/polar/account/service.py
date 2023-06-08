from __future__ import annotations
from typing import Tuple
from uuid import UUID


import structlog

from polar.models.user import User
from .schemas import AccountCreate, AccountLink, AccountUpdate


from polar.kit.services import ResourceService
from polar.models.account import Account
from polar.postgres import AsyncSession
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe


log = structlog.get_logger()


class AccountService(ResourceService[Account, AccountCreate, AccountUpdate]):
    async def create_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account | None:
        existing = await self.get_by(session=session, organization_id=organization_id)
        if existing is not None:
            return None

        if account.account_type != AccountType.stripe:
            return None

        try:
            stripe_account = stripe.create_account(account)
        except Exception:
            return None

        return await Account.create(
            session=session,
            organization_id=organization_id,
            admin_id=admin_id,
            account_type="stripe",
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

    async def onboarding_link_for_user(
        self,
        session: AsyncSession,
        organization_id: UUID,
        user: User,
        stripe_id: str,
        appendix: str | None = None,
    ) -> AccountLink | None:
        account = await self.get_by(
            session=session, organization_id=organization_id, stripe_id=stripe_id
        )
        if account is None or account.admin_id != user.id:
            # TODO: Error?
            return None

        account_link = stripe.create_account_link(stripe_id, appendix)
        return AccountLink(**account_link)

    async def dashboard_link(
        self,
        session: AsyncSession,
        organization_id: UUID,
        stripe_id: str,
    ) -> AccountLink | None:
        account = await self.get_by(
            session=session, organization_id=organization_id, stripe_id=stripe_id
        )
        if account is None:
            # TODO: Error?
            return None

        account_link = stripe.create_login_link(stripe_id)
        return AccountLink(**account_link)

    def get_balance(
        self,
        account: Account,
    ) -> Tuple[str, int] | None:
        if account.account_type != AccountType.stripe:
            return None
        return stripe.retrieve_balance(account.stripe_id)

    def transfer(
        self, session: AsyncSession, account: Account, amount: int, transfer_group: str
    ) -> str | None:
        if account.account_type != AccountType.stripe:
            return None
        transfer = stripe.transfer(
            destination_stripe_id=account.stripe_id,
            amount=amount,
            transfer_group=transfer_group,
        )
        return transfer.stripe_id


account = AccountService(Account)
