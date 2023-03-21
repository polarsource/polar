from __future__ import annotations
from uuid import UUID


import structlog
from .schemas import AccountCreate, AccountLink, AccountUpdate


from polar.kit.services import ResourceService
from polar.models.account import Account
from polar.postgres import AsyncSession
from polar.enums import AccountType
from polar.integrations.stripe.service import stripe


log = structlog.get_logger()


class AccountService(ResourceService[Account, AccountCreate, AccountUpdate]):
    async def create_stripe_account(
        self,
        session: AsyncSession,
        organization_id: UUID,
        admin_id: UUID,
        account: AccountCreate,
    ) -> Account | None:
        if (
            await self.get_by(session=session, organization_id=organization_id)
            is not None
        ):
            # TODO: Error?
            return None

        if account.account_type != AccountType.stripe:
            # TODO: Error?
            return None

        stripe_account = stripe.create_account()
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

    async def create_link(
        self, session: AsyncSession, organization_id: UUID, stripe_id: str
    ) -> AccountLink | None:
        if (
            await self.get_by(
                session=session, organization_id=organization_id, stripe_id=stripe_id
            )
            is None
        ):
            # TODO: Error?
            return None

        account_link = stripe.create_link(stripe_id)
        return AccountLink(**account_link)


account = AccountService(Account)
