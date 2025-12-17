from collections.abc import Sequence
from datetime import datetime
from typing import Any
from uuid import UUID

from sqlalchemy import asc, select
from sqlalchemy.orm import joinedload

from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import Account, AccountCredit, Campaign
from polar.postgres import AsyncReadSession, AsyncSession


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

    async def get_active(
        self,
        session: AsyncSession | AsyncReadSession,
        account: Account,
    ) -> Sequence[AccountCredit]:
        now = utc_now()
        stmt = (
            select(AccountCredit)
            .where(
                AccountCredit.account_id == account.id,
                (
                    (AccountCredit.expires_at.is_(None))
                    | (AccountCredit.expires_at > now)
                ),
                AccountCredit.revoked_at.is_(None),
                AccountCredit.deleted_at.is_(None),
                AccountCredit.amount > AccountCredit.used,
            )
            .order_by(asc(AccountCredit.granted_at))
        )
        result = await session.execute(stmt)
        return result.scalars().all()

    async def apply_to_fee(
        self,
        session: AsyncSession,
        account: Account,
        fee_amount: int,
    ) -> tuple[int, list[AccountCredit]]:
        if fee_amount <= 0 or account.credit_balance <= 0:
            return (0, [])

        active_credits = await self.get_active(session, account)
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

    async def get_all(
        self,
        session: AsyncSession | AsyncReadSession,
        account: Account,
        *,
        include_deleted: bool = False,
    ) -> Sequence[AccountCredit]:
        stmt = (
            select(AccountCredit)
            .where(AccountCredit.account_id == account.id)
            .options(joinedload(AccountCredit.campaign))
            .order_by(AccountCredit.granted_at.desc())
        )

        if not include_deleted:
            stmt = stmt.where(AccountCredit.deleted_at.is_(None))

        result = await session.execute(stmt)
        return result.scalars().unique().all()

    async def get_by_id(
        self,
        session: AsyncSession,
        credit_id: UUID,
        *,
        account: Account | None = None,
    ) -> AccountCredit | None:
        stmt = select(AccountCredit).where(
            AccountCredit.id == credit_id,
            AccountCredit.deleted_at.is_(None),
        )
        if account is not None:
            stmt = stmt.where(AccountCredit.account_id == account.id)

        result = await session.execute(stmt)
        return result.scalars().one_or_none()


account_credit_service = AccountCreditService(AccountCredit)
