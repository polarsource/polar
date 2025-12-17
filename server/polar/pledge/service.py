from __future__ import annotations

import datetime
from collections.abc import Sequence
from datetime import timedelta
from uuid import UUID

import structlog
from sqlalchemy import func, or_
from sqlalchemy.orm import (
    joinedload,
)

from polar.account.repository import AccountRepository
from polar.exceptions import (
    NotPermitted,
    ResourceNotFound,
)
from polar.integrations.stripe.schemas import PaymentIntentSuccessWebhook
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import generate_uuid, utc_now
from polar.models.issue_reward import IssueReward
from polar.models.pledge import Pledge, PledgeState, PledgeType
from polar.models.pledge_transaction import PledgeTransaction, PledgeTransactionType
from polar.models.user import User
from polar.models.user_organization import UserOrganization
from polar.postgres import AsyncSession, sql
from polar.transaction.service.balance import (
    balance_transaction as balance_transaction_service,
)
from polar.transaction.service.platform_fee import (
    platform_fee_transaction as platform_fee_transaction_service,
)

from .hooks import (
    PledgeHook,
    pledge_disputed,
    pledge_updated,
)

log = structlog.get_logger()


class PledgeService(ResourceServiceReader[Pledge]):
    async def get_with_loaded(
        self,
        session: AsyncSession,
        pledge_id: UUID,
    ) -> Pledge | None:
        statement = (
            sql.select(Pledge)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.by_organization),
                joinedload(Pledge.on_behalf_of_organization),
                joinedload(Pledge.created_by_user),
            )
            .filter(Pledge.id == pledge_id)
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def get_by_payment_id(
        self, session: AsyncSession, payment_id: str
    ) -> Pledge | None:
        statement = sql.select(Pledge).filter(Pledge.payment_id == payment_id)
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def list_by(
        self,
        session: AsyncSession,
        organization_ids: list[UUID] | None = None,
        pledging_user: UUID | None = None,
        pledging_organization: UUID | None = None,
        load_pledger: bool = False,
        all_states: bool = False,
    ) -> Sequence[Pledge]:
        statement = sql.select(Pledge)

        if not all_states:
            statement = statement.where(
                Pledge.state.in_(PledgeState.active_states()),
            )

        if organization_ids:
            statement = statement.where(Pledge.organization_id.in_(organization_ids))

        if pledging_user:
            statement = statement.where(Pledge.by_user_id == pledging_user)

        if pledging_organization:
            statement = statement.where(
                or_(
                    Pledge.by_organization_id == pledging_organization,
                    Pledge.on_behalf_of_organization_id == pledging_organization,
                )
            )

        if load_pledger:
            statement = statement.options(
                joinedload(Pledge.by_organization),
                joinedload(Pledge.user),
                joinedload(Pledge.on_behalf_of_organization),
                joinedload(Pledge.created_by_user),
            )

        statement = statement.order_by(Pledge.created_at)

        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def get_by_issue_reference(
        self,
        session: AsyncSession,
        issue_reference: str,
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .options(
                joinedload(Pledge.organization),
            )
            .where(
                Pledge.state.in_(PledgeState.active_states()),
                Pledge.issue_reference == issue_reference,
                Pledge.payment_id.is_not(None),
            )
            .order_by(Pledge.created_at.desc())
        )
        res = await session.execute(statement)
        return res.scalars().unique().all()

    async def list_by_pledging_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Pledge]:
        # Deprecated, please use list_by directly
        return await self.list_by(session, pledging_user=user_id)

    async def connect_backer(
        self,
        session: AsyncSession,
        payment_intent_id: str,
        backer: User,
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id=payment_intent_id)
        if not pledge:
            raise ResourceNotFound(
                f"Pledge not found with payment_id: {payment_intent_id}"
            )

        # This pledge is already connected
        if pledge.by_user_id or pledge.by_organization_id:
            return None

        pledge.by_user_id = backer.id
        session.add(pledge)

    async def handle_payment_intent_success(
        self,
        session: AsyncSession,
        payload: PaymentIntentSuccessWebhook,
    ) -> None:
        pledge = await self.get_by_payment_id(session, payload.id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payload.id}")

        log.info(
            "handle_payment_intent_success",
            payment_id=payload.id,
        )

        # Log Transaction
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.pledge,
                amount=payload.amount_received,
                transaction_id=payload.latest_charge,
            )
        )
        await session.commit()

        if pledge.type == PledgeType.pay_on_completion:
            return await self.handle_paid_invoice(
                session,
                payment_id=payload.id,
                amount_received=payload.amount_received,
                transaction_id=payload.latest_charge,
            )

        raise Exception(f"unhandeled pledge type type: {pledge.type}")

    async def handle_paid_invoice(
        self,
        session: AsyncSession,
        payment_id: str,
        amount_received: int,
        transaction_id: str,
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        if pledge.state not in PledgeState.to_pending_states():
            raise Exception(f"pledge is in unexpected state: {pledge.state}")

        if pledge.type != PledgeType.pay_on_completion:
            raise Exception(f"pledge is of unexpected type: {pledge.type}")

        stmt = (
            sql.Update(Pledge)
            .where(
                Pledge.id == pledge.id,
                Pledge.state.in_(PledgeState.to_pending_states()),
            )
            .values(
                state=PledgeState.pending,
                amount_received=amount_received,
            )
        )
        await session.execute(stmt)

        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.pledge,
                amount=amount_received,
                transaction_id=transaction_id,
            )
        )
        await session.commit()
        await self.after_pledge_updated(session, pledge)

    async def refund_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        if pledge.state not in PledgeState.to_refunded_states():
            raise NotPermitted("Refunding error, unexpected pledge status")

        pledge.refunded_at = utc_now()
        if amount == pledge.amount:
            pledge.state = PledgeState.refunded
        elif amount < pledge.amount:
            pledge.amount -= amount
        else:
            raise NotPermitted("Refunding error, unexpected amount!")
        session.add(pledge)
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.refund,
                amount=amount,
                transaction_id=transaction_id,
            )
        )
        await self.after_pledge_updated(session, pledge)

    async def mark_charge_disputed_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        # charge_disputed (aka chargebacks) can be triggered from _any_ pledge state
        # not checking existing state here

        pledge.state = PledgeState.charge_disputed
        session.add(pledge)
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.disputed,
                amount=amount,
                transaction_id=transaction_id,
            )
        )
        await session.commit()
        await self.after_pledge_updated(session, pledge)

    async def get_reward(
        self, session: AsyncSession, split_id: UUID
    ) -> IssueReward | None:
        stmt = sql.select(IssueReward).where(IssueReward.id == split_id)
        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def get_transaction(
        self,
        session: AsyncSession,
        type: PledgeTransactionType | None = None,
        pledge_id: UUID | None = None,
        issue_reward_id: UUID | None = None,
    ) -> PledgeTransaction | None:
        stmt = sql.select(PledgeTransaction)

        if type:
            stmt = stmt.where(PledgeTransaction.type == type)
        if pledge_id:
            stmt = stmt.where(PledgeTransaction.pledge_id == pledge_id)
        if issue_reward_id:
            stmt = stmt.where(PledgeTransaction.issue_reward_id == issue_reward_id)

        res = await session.execute(stmt)
        return res.scalars().unique().one_or_none()

    async def transfer(
        self, session: AsyncSession, pledge_id: UUID, issue_reward_id: UUID
    ) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state not in PledgeState.to_paid_states():
            raise NotPermitted("Pledge is not in pending state")
        if pledge.scheduled_payout_at and pledge.scheduled_payout_at > utc_now():
            raise NotPermitted(
                "Pledge is not ready for payput (still in dispute window)"
            )

        # get receiver
        split = await self.get_reward(session, issue_reward_id)
        if not split:
            raise ResourceNotFound(f"IssueReward not found with id: {issue_reward_id}")

        if not split.user_id and not split.organization_id:
            raise NotPermitted(
                "Either user_id or organization_id must be set on the split to create a transfer"
            )

        # sanity check
        if split.share_thousands < 0 or split.share_thousands > 1000:
            raise NotPermitted("unexpected split share")

        # check that this transfer hasn't already been made!
        existing_trx = await self.get_transaction(
            session, pledge_id=pledge.id, issue_reward_id=split.id
        )
        if existing_trx:
            raise NotPermitted(
                "A transfer for this pledge_id and issue_reward_id already exists, refusing to make another one"
            )

        # pledge amount * the users share
        payout_amount = split.get_share_amount(pledge)

        account_repository = AccountRepository.from_session(session)
        if split.user_id:
            pay_to_account = await account_repository.get_by_user(split.user_id)
            if pay_to_account is None:
                raise NotPermitted("Receiving user has no account")

        elif split.organization_id:
            pay_to_account = await account_repository.get_by_organization(
                split.organization_id
            )
            if pay_to_account is None:
                raise NotPermitted("Receiving organization has no account")
        else:
            raise NotPermitted("Unexpected split receiver")

        assert pledge.payment_id is not None

        balance_transactions = (
            await balance_transaction_service.create_balance_from_payment_intent(
                session,
                source_account=None,
                destination_account=pay_to_account,
                payment_intent_id=pledge.payment_id,
                amount=payout_amount,
                pledge=pledge,
                issue_reward=split,
            )
        )
        await platform_fee_transaction_service.create_fees_reversal_balances(
            session, balance_transactions=balance_transactions
        )

        transaction = PledgeTransaction(
            pledge_id=pledge.id,
            type=PledgeTransactionType.transfer,
            amount=payout_amount,
            issue_reward_id=split.id,
        )

        session.add(transaction)
        await session.commit()

    async def admin_transfer(
        self,
        session: AsyncSession,
        pledge_id: UUID,
    ) -> None:
        """
        Transfer a pledge directly to the organization (100% of amount minus fees).
        Similar to the regular transfer method but without reward split logic.

        Args:
            pledge_id: The pledge to transfer

        Raises:
            PledgeError: If pledge is not in valid state for transfer
        """
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")

        # Check if pledge is pay_upfront type
        if pledge.type != PledgeType.pay_upfront:
            raise NotPermitted(f"Pledge is not pay_upfront type: {pledge.type}")

        # Update state to mimic old automatic state transfer from GitHub events
        if pledge.state == PledgeState.created:
            pledge.state = PledgeState.pending

        if not pledge.scheduled_payout_at:
            pledge.scheduled_payout_at = utc_now() - timedelta(seconds=10)

        session.add(pledge)

        # Create a 100% reward in admin to the receiving organization (unless it exists already)
        stmt = sql.select(IssueReward).where(
            IssueReward.organization_id == pledge.organization_id,
            IssueReward.issue_reference == pledge.issue_reference,
        )
        res = await session.execute(stmt)
        reward = res.scalars().unique().one_or_none()
        if not reward:
            reward = IssueReward(
                id=generate_uuid(),
                issue_reference=pledge.issue_reference,
                share_thousands=1000,  # 100%
                organization_id=pledge.organization_id,
            )
            session.add(reward)

        # Now we can proceed with a regular old-school transfer
        return await self.transfer(
            session,
            pledge_id=pledge.id,
            issue_reward_id=reward.id,
        )

    async def mark_disputed(
        self,
        session: AsyncSession,
        pledge_id: UUID,
        by_user_id: UUID,
        reason: str,
    ) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state not in PledgeState.to_disputed_states():
            raise NotPermitted(f"Pledge is unexpected state: {pledge.state}")

        stmt = (
            sql.update(Pledge)
            .where(Pledge.id == pledge_id)
            .values(
                state=PledgeState.disputed,
                dispute_reason=reason,
                disputed_at=datetime.datetime.now(),
                disputed_by_user_id=by_user_id,
            )
        )
        await session.execute(stmt)
        await session.commit()

        await pledge_disputed.call(PledgeHook(session, pledge))
        await self.after_pledge_updated(session, pledge)

    async def after_pledge_updated(
        self,
        session: AsyncSession,
        pledge: Pledge,
    ) -> None:
        full_pledge = await self.get_with_loaded(session, pledge.id)
        assert full_pledge

        await pledge_updated.call(PledgeHook(session, full_pledge))

    def user_can_admin_sender_pledge(
        self, user: User, pledge: Pledge, memberships: Sequence[UserOrganization]
    ) -> bool:
        """
        Returns true if the User can modify the pledge on behalf of the entity that sent
        the pledge, such as disputing it.
        """

        if pledge.by_user_id == user.id:
            return True

        if pledge.by_organization_id:
            for m in memberships:
                if m.organization_id == pledge.by_organization_id:
                    return True

        return False

    async def sum_pledges_period(
        self,
        session: AsyncSession,
        organization_id: UUID,
        user_id: UUID | None = None,
    ) -> int:
        stmt = sql.select(func.sum(Pledge.amount)).where(
            Pledge.by_organization_id == organization_id
        )

        if user_id:
            stmt = stmt.where(Pledge.created_by_user_id == user_id)

        now = utc_now()
        (start, end) = self.month_range(now)
        stmt = stmt.where(
            Pledge.created_at >= start,
            Pledge.created_at <= end,
        )

        ret = await session.execute(stmt)
        res = ret.scalars().one_or_none()

        if not res:
            return 0

        return res

    """
    month_range returns the first and the last second of the month that ts is in
    """

    def month_range(
        self, ts: datetime.datetime
    ) -> tuple[datetime.datetime, datetime.datetime]:
        # go to first day and second of the month
        start = ts.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        # add 35 days to skip to the next month
        end = start + timedelta(days=35)
        # go to the first day of the next month
        end = end.replace(day=1)
        # go back one second to find the last second of the "current" month
        end = end - timedelta(seconds=1)

        return (start, end)


pledge = PledgeService(Pledge)
