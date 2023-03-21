from __future__ import annotations
from uuid import UUID


import structlog
from .schemas import AccountCreate, AccountUpdate


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
        if account.type != AccountType.stripe:
            # TODO: Error?
            return None

        stripe_account = stripe.create_account()
        return await Account.create(
            session=session,
            organization_id=organization_id,
            admin_id=admin_id,
            stripe_id=stripe_account.stripe_id,
            email=stripe_account.email,
            country=stripe_account.country,
            currency=stripe_account.default_currency,
            is_details_submitted=stripe_account.details_submitted,
            is_charges_enabled=stripe_account.charges_enabled,
            is_payouts_enabled=stripe_account.payouts_enabled,
            type=stripe_account.business_type,
            data=stripe_account.to_dict(),
        )


account = AccountService(Account)
