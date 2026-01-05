from datetime import datetime
from typing import Any
from uuid import UUID

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import Account, AccountCredit, Campaign, Organization
from polar.notifications.notification import (
    MaintainerAccountCreditsGrantedNotificationPayload,
    NotificationType,
)
from polar.notifications.service import PartialNotification
from polar.notifications.service import notifications as notifications_service
from polar.postgres import AsyncSession

from .repository import AccountCreditRepository


class AccountCreditError(PolarError): ...


class InsufficientCreditsError(AccountCreditError):
    def __init__(self, available: int, requested: int) -> None:
        self.available = available
        self.requested = requested
        message = f"Insufficient credits: {available} available, {requested} requested"
        super().__init__(message)


class CreditAlreadyRevokedError(AccountCreditError):
    def __init__(self, credit_id: UUID) -> None:
        self.credit_id = credit_id
        super().__init__(f"Credit {credit_id} is already revoked")


class AccountCreditService(ResourceServiceReader[AccountCredit]):
    async def grant_from_campaign(
        self,
        session: AsyncSession,
        *,
        account: Account,
        campaign: Campaign,
    ) -> AccountCredit | None:
        if campaign.fee_credit is None:
            return None

        title = campaign.fee_credit_title
        if not title:
            title = "Signup Bonus"

        return await self.grant(
            session,
            account=account,
            amount=campaign.fee_credit,
            title=title,
            expires_at=campaign.ends_at,
            notes=f"Created from campaign: {campaign.id}",
            user_metadata={"campaign_id": str(campaign.id)},
        )

    async def grant(
        self,
        session: AsyncSession,
        *,
        account: Account,
        amount: int,
        title: str,
        expires_at: datetime | None = None,
        notes: str | None = None,
        user_metadata: dict[str, Any] | None = None,
        organization: Organization | None = None,
    ) -> AccountCredit:
        meta = user_metadata if user_metadata else {}
        credit = AccountCredit(
            account_id=account.id,
            campaign_id=None,
            title=title,
            amount=amount,
            used=0,
            granted_at=utc_now(),
            expires_at=expires_at,
            notes=notes,
            user_metadata=meta,
        )
        session.add(credit)

        account.credit_balance += amount
        session.add(account)

        await session.flush()

        if organization:
            await notifications_service.send_to_org_members(
                session,
                org_id=organization.id,
                notif=PartialNotification(
                    type=NotificationType.maintainer_account_credits_granted,
                    payload=MaintainerAccountCreditsGrantedNotificationPayload(
                        organization_name=organization.name,
                        amount=amount,
                    ),
                ),
            )

        return credit

    async def revoke(
        self,
        session: AsyncSession,
        credit: AccountCredit,
        *,
        account: Account,
    ) -> AccountCredit:
        if credit.revoked_at is not None:
            raise CreditAlreadyRevokedError(credit.id)

        credit.revoked_at = utc_now()
        session.add(credit)

        account.reduce_credit_balance(credit.amount)
        session.add(account)

        await session.flush()
        return credit

    async def apply_to_fee(
        self,
        session: AsyncSession,
        account: Account,
        fee_amount: int,
    ) -> tuple[int, list[AccountCredit]]:
        if fee_amount <= 0 or account.credit_balance <= 0:
            return (0, [])

        repository = AccountCreditRepository.from_session(session)
        active_credits = await repository.get_active(account.id)
        if not active_credits:
            # Update account.credit_balance to reflect expired credits (no longer active)
            account.credit_balance = 0
            session.add(account)
            await session.flush()
            return (0, [])

        amount_applied = 0
        credits_used: list[AccountCredit] = []
        remaining_fee = fee_amount

        for credit in active_credits:
            if remaining_fee <= 0:
                break

            available = credit.remaining
            to_apply = min(available, remaining_fee)

            credit.used += to_apply
            amount_applied += to_apply
            remaining_fee -= to_apply
            credits_used.append(credit)

            session.add(credit)

        account.reduce_credit_balance(amount_applied)
        session.add(account)

        await session.flush()
        return (amount_applied, credits_used)


account_credit_service = AccountCreditService(AccountCredit)
