import datetime
from collections.abc import Sequence
from enum import StrEnum
from typing import Any, Literal
from uuid import UUID

import stripe as stripe_lib
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed
from slack_sdk.webhook import WebhookClient as SlackWebhookClient
from sqlalchemy import (
    ColumnExpressionArgument,
    UnaryExpression,
    and_,
    asc,
    desc,
    func,
    text,
)
from sqlalchemy.orm import joinedload

from polar.account.service import account as account_service
from polar.config import settings
from polar.currency.schemas import CurrencyAmount
from polar.donation.schemas import DonationStatisticsPeriod
from polar.held_balance.service import held_balance as held_balance_service
from polar.integrations.stripe.schemas import (
    DonationPaymentIntentMetadata,
    PaymentIntentSuccessWebhook,
)
from polar.integrations.stripe.service import stripe as stripe_service
from polar.kit.money import get_cents_in_dollar_string
from polar.kit.pagination import PaginationParams, paginate
from polar.kit.sorting import Sorting
from polar.kit.utils import utc_now
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
from polar.user.service import user as user_service
from polar.webhook_notifications.service import webhook_notifications_service


class SearchSortProperty(StrEnum):
    amount = "amount"
    created_at = "created_at"


class DonationService:
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

    async def search(
        self,
        session: AsyncSession,
        *,
        to_organization: Organization,
        pagination: PaginationParams,
        sorting: list[Sorting[SearchSortProperty]] = [
            (SearchSortProperty.created_at, True)
        ],
    ) -> tuple[Sequence[Donation], int]:
        statement = (
            sql.select(Donation)
            .where(Donation.to_organization_id == to_organization.id)
            .options(
                joinedload(Donation.to_organization),
                joinedload(Donation.by_organization),
                joinedload(Donation.on_behalf_of_organization),
                joinedload(Donation.by_user),
            )
        )

        order_by_clauses: list[UnaryExpression[Any]] = []
        for criterion, is_desc in sorting:
            clause_function = desc if is_desc else asc
            if criterion == SearchSortProperty.amount:
                order_by_clauses.append(clause_function(Donation.amount_received))
            if criterion == SearchSortProperty.created_at:
                order_by_clauses.append(clause_function(Donation.created_at))

        statement = statement.order_by(*order_by_clauses)

        results, count = await paginate(session, statement, pagination=pagination)

        return results, count

    async def create_payment_intent(
        self,
        session: AsyncSession,
        *,
        by_user: User | None,
        by_organization: Organization | None,
        on_behalf_of_organization: Organization | None,
        to_organization: Organization,
        amount: CurrencyAmount,
        receipt_email: str,
        message: str | None,
        issue_id: UUID | None,
    ) -> stripe_lib.PaymentIntent:
        metadata = DonationPaymentIntentMetadata(
            to_organization_id=to_organization.id,
            to_organization_name=to_organization.name,
        )

        if by_user:
            metadata.by_user_id = by_user.id

        if by_organization:
            metadata.by_organization_id = by_organization.id

        if on_behalf_of_organization:
            metadata.on_behalf_of_organization_id = on_behalf_of_organization.id

        if message:
            metadata.donation_message = message

        if issue_id:
            metadata.issue_id = issue_id

        customer: User | Organization | None = None
        if by_organization:
            customer = by_organization
        elif by_user:
            customer = by_user

        return await stripe_service.create_payment_intent(
            session=session,
            amount=amount,
            metadata=metadata,
            receipt_email=receipt_email,
            description=f"Donation to {to_organization.name}",
            customer=customer,
        )

    async def update_payment_intent(
        self,
        session: AsyncSession,
        *,
        payment_intent_id: str,
        by_user: User | None,
        by_organization: Organization | None,
        on_behalf_of_organization: Organization | None,
        amount: CurrencyAmount,
        receipt_email: str,
        setup_future_usage: Literal["off_session", "on_session"] | None = None,
        message: str | None,
    ) -> stripe_lib.PaymentIntent:
        # Set to empty string to unset previous values
        metadata = DonationPaymentIntentMetadata(
            on_behalf_of_organization_id=(
                on_behalf_of_organization.id if on_behalf_of_organization else ""
            ),
            donation_message=message if message else "",
            by_user_id=by_user.id if by_user else "",
            by_organization_id=by_organization.id if by_organization else "",
        )

        customer: User | Organization | None = None
        if by_organization:
            customer = by_organization
        elif by_user:
            customer = by_user

        return await stripe_service.modify_payment_intent(
            session=session,
            id=payment_intent_id,
            amount=amount,
            metadata=metadata,
            receipt_email=receipt_email,
            customer=customer,
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

        by_user: User | None = None
        if metadata.by_user_id:
            by_user = await user_service.get(session, metadata.by_user_id)

        by_organization: Organization | None = None
        if metadata.by_organization_id:
            by_organization = await organization_service.get(
                session, metadata.by_organization_id
            )

        on_behalf_of_organization: Organization | None = None
        if metadata.on_behalf_of_organization_id:
            on_behalf_of_organization = await organization_service.get(
                session, metadata.on_behalf_of_organization_id
            )

        d = Donation(
            to_organization_id=metadata.to_organization_id,
            payment_id=payload.id,
            charge_id=payload.latest_charge,
            amount=payload.amount,
            amount_received=payload.amount_received,
            email=payload.receipt_email,
            message=metadata.donation_message,
            by_user=by_user,
            by_organization=by_organization,
            on_behalf_of_organization=on_behalf_of_organization,
            issue_id=metadata.issue_id if metadata.issue_id else None,
        )

        session.add(d)

        await self.backoffice_discord_notification(session, d)
        await self.user_webhook_notifications(session, d)

        return None

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

    async def statistics(
        self,
        session: AsyncSession,
        *,
        to_organization_id: UUID,
        start_date: datetime.date,
        end_date: datetime.date,
        interval: Literal["month", "week", "day"],
        start_of_last_period: datetime.date | None = None,
    ) -> Sequence[DonationStatisticsPeriod]:
        interval_txt = {
            "month": "interval 'P1M'",
            "week": "interval 'P1W'",
            "day": "interval 'P1D'",
        }[interval]

        sql_interval = text(interval_txt)

        start_date_column = func.generate_series(
            start_date, end_date, sql_interval
        ).column_valued("start_date")
        end_date_column = start_date_column + sql_interval

        start_of_last_period = start_of_last_period or utc_now().date().replace(day=1)

        joinclauses: list[ColumnExpressionArgument[bool]] = []
        joinclauses.append(Donation.to_organization_id == to_organization_id)

        stmt = (
            sql.select(
                start_date_column,
            )
            .add_columns(
                end_date_column,
                func.coalesce(
                    func.sum(Donation.amount_received).filter(
                        Donation.created_at >= start_date_column,
                        Donation.created_at < end_date_column,
                    ),
                    0,
                ),
            )
            .join(
                Donation,
                onclause=and_(True, *joinclauses),
            )
            .where(start_date_column <= start_of_last_period)
            .group_by(start_date_column)
            .order_by(start_date_column)
        )

        res = await session.execute(stmt)

        return [
            DonationStatisticsPeriod(
                start_date=row_start_date,
                end_date=row_end_date,
                sum=sum,
            )
            for (row_start_date, row_end_date, sum) in res.tuples().all()
        ]

    async def backoffice_discord_notification(
        self, session: AsyncSession, donation: Donation
    ) -> None:
        if not settings.DISCORD_WEBHOOK_URL:
            return

        to_org = await organization_service.get(session, donation.to_organization_id)
        if not to_org:
            return

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL, content="New Donation"
        )

        embed = DiscordEmbed(
            title="New Donation",
            description=f"${get_cents_in_dollar_string(donation.amount_received)} to {to_org.name}\n\n> {donation.message or "No message"}",  # noqa: E501
            color="65280",
        )

        embed.add_embed_field(
            name=to_org.name,
            value=f"[{to_org.name}](https://polar.sh/{to_org.name})",
        )

        webhook.add_embed(embed)
        await webhook.execute()

    async def user_webhook_notifications(
        self, session: AsyncSession, donation: Donation
    ) -> None:
        webhooks = await webhook_notifications_service.search(
            session, organization_id=donation.to_organization_id
        )
        to_org = await organization_service.get(session, donation.to_organization_id)
        if not to_org:
            return

        _donation_amount = donation.amount_received / 100
        description = f"A ${_donation_amount} donation has been made to {to_org.name}\n\n> {donation.message or "No message"}"

        for wh in webhooks:
            if wh.integration == "discord":
                webhook = AsyncDiscordWebhook(
                    url=wh.url, content="New Donation Received"
                )

                embed = DiscordEmbed(
                    title="New Donation Received",
                    description=description,
                    color="65280",
                )

                embed.set_thumbnail(url=settings.THUMBNAIL_URL)
                embed.set_author(name="Polar.sh", icon_url=settings.FAVICON_URL)
                embed.add_embed_field(
                    name="Amount", value=f"${_donation_amount}", inline=True
                )
                embed.set_footer(text="Powered by Polar.sh")

                webhook.add_embed(embed)
                await webhook.execute()
                continue

            if wh.integration == "slack":
                slack_webhook = SlackWebhookClient(wh.url)
                response = slack_webhook.send(
                    text=description,
                    blocks=[
                        {
                            "type": "section",
                            "text": {
                                "type": "mrkdwn",
                                "text": description,
                            },
                            "accessory": {
                                "type": "button",
                                "text": {"type": "plain_text", "text": "Open"},
                                "url": f"https://polar.sh/{to_org.name}",
                            },
                        },
                    ],
                )


donation_service = DonationService()
