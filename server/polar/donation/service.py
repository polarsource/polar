from typing import Literal

import stripe as stripe_lib

from polar.account.service import account as account_service
from polar.currency.schemas import CurrencyAmount
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PaymentIntentSuccessWebhook,
)
from polar.integrations.stripe.service import stripe as stripe_service
from polar.models.donation import Donation
from polar.models.held_balance import HeldBalance
from polar.models.organization import Organization
from polar.models.transaction import Transaction
from polar.models.user import User
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notification_service
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, sql
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)


class DonationService:
    async def create_payment_intent(
        self,
        session: AsyncSession,
        *,
        user: User | None,
        on_behalf_of_organization: Organization | None,
        to_organization: Organization,
        amount: CurrencyAmount,
        receipt_email: str,
    ) -> stripe_lib.PaymentIntent:
        metadata = DonationPaymentIntentMetadata(
            to_organization_id=to_organization.id,
            to_organization_name=to_organization.name,
        )

        if on_behalf_of_organization:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization.id

        return await stripe_service.create_payment_intent(
            session=session,
            amount=amount,
            metadata=metadata,
            receipt_email=receipt_email,
            description=f"Donation to {to_organization.name}",
            customer=on_behalf_of_organization if on_behalf_of_organization else user,
        )

    async def update_payment_intent(
        self,
        session: AsyncSession,
        *,
        payment_intent_id: str,
        user: User | None,
        on_behalf_of_organization: Organization | None,
        amount: CurrencyAmount,
        receipt_email: str,
        setup_future_usage: Literal["off_session", "on_session"] | None = None,
    ) -> stripe_lib.PaymentIntent:
        metadata = DonationPaymentIntentMetadata()

        if on_behalf_of_organization:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization.id

        return await stripe_service.modify_payment_intent(
            session=session,
            id=payment_intent_id,
            amount=amount,
            metadata=metadata,
            receipt_email=receipt_email,
            customer=on_behalf_of_organization if on_behalf_of_organization else user,
            setup_future_usage=setup_future_usage,
        )

    async def handle_payment_intent_success(
        self,
        session: AsyncSession,
        payload: PaymentIntentSuccessWebhook,
        metadata: DonationPaymentIntentMetadata,
    ) -> None:
        assert payload.status == "succeeded"
        assert metadata.to_organization_id

        d = Donation(
            to_organization_id=metadata.to_organization_id,
            payment_id=payload.id,
            charge_id=payload.latest_charge,
            amount=payload.amount,
            amount_received=payload.amount_received,
            email=payload.receipt_email,
        )
        session.add(d)
        return None

    async def get_by_payment_id(
        self, session: AsyncSession, id: str
    ) -> Donation | None:
        stmt = sql.select(Donation).where(Donation.payment_id == id)
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    async def create_balance(
        self,
        session: AsyncSession,
        *,
        donation: Donation,
        payment_transaction: Transaction,
    ) -> None:
        # assert invoice.charge is not None

        # if invoice.subscription is None:
        #     return

        # stripe_subscription_id = get_expandable_id(invoice.subscription)
        # subscription = await self.get_by_stripe_subscription_id(
        #     session, stripe_subscription_id
        # )
        # if subscription is None:
        #     raise SubscriptionDoesNotExist(stripe_subscription_id)

        # await session.refresh(subscription, {"subscription_tier", "price"})
        # account = await subscription_tier_service.get_managing_organization_account(
        #     session, subscription.subscription_tier
        # )

        assert payment_transaction.charge_id == donation.charge_id

        account = await account_service.get_by_organization_id(
            session, donation.to_organization_id
        )
        # assert account

        # tax = invoice.tax or 0
        # transfer_amount = invoice.total - tax

        # charge_id = donation.payment_id  # ?
        # assert charge_id

        # # Prepare an held balance
        # # It'll be used if the account is not created yet

        # Prepare an held balance
        # It'll be used if the account is not created yet
        # payment_transaction = await balance_transaction_service.get_by(
        #     session, type=TransactionType.payment, charge_id=charge_id
        # )
        # if payment_transaction is None:
        #     raise PaymentTransactionForChargeDoesNotExist(charge_id)
        held_balance = HeldBalance(
            amount=donation.amount_received,
            # subscription=subscription,
            # subscription_tier_price=subscription.price,
            payment_transaction=payment_transaction,
        )

        # No account, create the held balance
        if account is None:
            # managing_organization = await organization_service.get(
            #     session, subscription.subscription_tier.managing_organization_id
            # )
            # assert managing_organization is not None

            to_organization = await organization_service.get(
                session, donation.to_organization_id
            )

            assert to_organization is not None

            held_balance.organization_id = donation.to_organization.id
            await held_balance_service.create(session, held_balance=held_balance)

            await notification_service.send_to_org_admins(
                session=session,
                org_id=donation.to_organization_id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_create_account,
                    payload=MaintainerCreateAccountNotificationPayload(
                        organization_name=to_organization.name,
                        url=to_organization.account_url,
                    ),
                ),
            )

            return

        # Account created, create the balance immediately
        balance_transactions = (
            await balance_transaction_service.create_balance_from_charge(
                session,
                source_account=None,
                destination_account=account,
                charge_id=donation.charge_id,
                amount=donation.amount_received,
                donation=donation,
            )
        )
        await platform_fee_transaction_service.create_fees_reversal_balances(
            session, balance_transactions=balance_transactions
        )


donation_service = DonationService()
