from typing import Literal

import stripe as stripe_lib
from sqlalchemy.orm import joinedload

from polar.account.service import account as account_service
from polar.currency.schemas import CurrencyAmount
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PaymentIntentSuccessWebhook,
)
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.money import get_cents_in_dollar_string
from polar.models.donation import Donation
from polar.models.held_balance import HeldBalance
from polar.models.organization import Organization
from polar.models.transaction import Transaction
from polar.models.user import User
from polar.notifications.notification import (
    MaintainerCreateAccountNotificationPayload,
    MaintainerDonationReceivedNotificationPayload,
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
        message: str | None,
    ) -> stripe_lib.PaymentIntent:
        metadata = DonationPaymentIntentMetadata(
            to_organization_id=to_organization.id,
            to_organization_name=to_organization.name,
        )

        if on_behalf_of_organization:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization.id

        if message:
            metadata.donation_message = message

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
        message: str | None,
    ) -> stripe_lib.PaymentIntent:
        metadata = DonationPaymentIntentMetadata()

        if on_behalf_of_organization:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization.id
        else:
            # Set to empty string to unset previous value
            metadata.on_behalf_of_organization_id = ""

        if message:
            metadata.donation_message = message
        else:
            # Set to empty string to unset previous value
            metadata.donation_message = ""

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
            message=metadata.donation_message,
        )

        session.add(d)
        return None

    async def get_by_payment_id(
        self, session: AsyncSession, id: str
    ) -> Donation | None:
        stmt = (
            sql.select(Donation)
            .where(Donation.payment_id == id)
            .options(joinedload(Donation.to_organization))
        )
        res = await session.execute(stmt)
        return res.scalar_one_or_none()

    async def create_balance(
        self,
        session: AsyncSession,
        *,
        donation: Donation,
        payment_transaction: Transaction,
    ) -> None:
        assert payment_transaction.charge_id == donation.charge_id

        account = await account_service.get_by_organization_id(
            session, donation.to_organization_id
        )

        to_organization = await organization_service.get(
            session, donation.to_organization_id
        )
        assert to_organization is not None

        # No account, create the held balance
        if account is None:
            held_balance = HeldBalance(
                amount=donation.amount_received,
                payment_transaction=payment_transaction,
                donation=donation,
                organization_id=donation.to_organization.id,
            )
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

        # Send notification to receiving org
        await notification_service.send_to_org_admins(
            session,
            donation.to_organization_id,
            notif=PartialNotification(
                type=NotificationType.maintainer_donation_received,
                payload=MaintainerDonationReceivedNotificationPayload(
                    organization_name=to_organization.name,
                    donation_amount=get_cents_in_dollar_string(
                        donation.amount_received
                    ),
                    donation_id=donation.id,
                ),
            ),
        )


donation_service = DonationService()
