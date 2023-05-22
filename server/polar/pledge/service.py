from __future__ import annotations
from datetime import date, timedelta
import datetime
import math

from uuid import UUID
from typing import List, Sequence
from discord_webhook import AsyncDiscordWebhook, DiscordEmbed

import structlog
from polar.config import settings
from polar.enums import Platforms

from polar.kit.services import ResourceServiceReader
from polar.integrations.stripe.service import stripe
from polar.kit.utils import utc_now
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.issue.service import issue as issue_service
from polar.postgres import AsyncSession, sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.organization.service import organization as organization_service
from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound, NotPermitted

from .schemas import (
    PledgeCreate,
    PledgeMutationResponse,
    PledgeTransactionType,
    PledgeUpdate,
    PledgeState,
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
                joinedload(Pledge.organization),
                joinedload(Pledge.issue).joinedload(Issue.organization),
                joinedload(Pledge.issue).joinedload(Issue.repository),
            )
            .filter(Pledge.id == pledge_id)
        )
        res = await session.execute(statement)
        return res.scalars().unique().one_or_none()

    async def list_by_repository(
        self, session: AsyncSession, repository_id: UUID
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .where(
                Pledge.repository_id == repository_id,
                Pledge.state.in_(PledgeState.active_states()),
            )
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def list_by_pledging_user(
        self, session: AsyncSession, user_id: UUID
    ) -> Sequence[Pledge]:
        statement = (
            sql.select(Pledge)
            .where(
                Pledge.by_user_id == user_id,
                Pledge.state.in_(PledgeState.active_states()),
            )
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def get_by_issue_ids(
        self,
        session: AsyncSession,
        issue_ids: List[UUID],
    ) -> Sequence[Pledge]:
        if not issue_ids:
            return []
        statement = (
            sql.select(Pledge)
            .options(
                joinedload(Pledge.user),
                joinedload(Pledge.organization),
            )
            .filter(
                Pledge.issue_id.in_(issue_ids),
                Pledge.state.in_(PledgeState.active_states()),
            )
        )
        res = await session.execute(statement)
        issues = res.scalars().unique().all()
        return issues

    async def create_pledge(
        self,
        user: User | None,
        platform: Platforms,
        pledge: PledgeCreate,
        org: Organization,
        repo: Repository,
        issue: Issue,
        session: AsyncSession,
    ) -> PledgeMutationResponse:
        # Pre-authenticated pledge flow (with saved CC)
        if pledge.pledge_as_org and user:
            return await self.create_pledge_as_org(
                platform,
                org,
                repo,
                issue,
                pledge,
                user,
                session,
            )

        # Pledge flow with logged in user
        if user:
            return await self.create_pledge_user(
                platform,
                org,
                repo,
                issue,
                pledge,
                user,
                session,
            )

        return await self.create_pledge_anonymous(
            platform,
            org,
            repo,
            issue,
            pledge,
            session,
        )

    async def create_pledge_anonymous(
        self,
        platform: Platforms,
        org: Organization,
        repo: Repository,
        issue: Issue,
        pledge: PledgeCreate,
        session: AsyncSession,
    ) -> PledgeMutationResponse:
        if not pledge.email:
            raise NotPermitted("pledge.email is required for anonymous pledges")

        # Create the pledge
        db_pledge = await self.create_db_pledge(
            session=session,
            issue=issue,
            repo=repo,
            org=org,
            pledge=pledge,
        )

        # Create a payment intent with Stripe
        payment_intent = stripe.create_anonymous_intent(
            amount=db_pledge.amount_including_fee,
            transfer_group=f"{db_pledge.id}",
            issue=issue,
            anonymous_email=pledge.email,
        )

        # Store the intent id
        db_pledge.payment_id = payment_intent.id
        await db_pledge.save(session)

        ret = PledgeMutationResponse.from_orm(db_pledge)
        ret.client_secret = payment_intent.client_secret

        return ret

    async def create_pledge_user(
        self,
        platform: Platforms,
        org: Organization,
        repo: Repository,
        issue: Issue,
        pledge: PledgeCreate,
        user: User,
        session: AsyncSession,
    ) -> PledgeMutationResponse:
        # Create the pledge
        db_pledge = await self.create_db_pledge(
            session=session,
            issue=issue,
            repo=repo,
            org=org,
            pledge=pledge,
            by_user=user,
        )

        # Create a payment intent with Stripe
        payment_intent = stripe.create_user_intent(
            amount=db_pledge.amount_including_fee,
            transfer_group=f"{db_pledge.id}",
            issue=issue,
            user=user,
        )

        # Store the intent id
        db_pledge.payment_id = payment_intent.id
        await db_pledge.save(session)

        ret = PledgeMutationResponse.from_orm(db_pledge)
        ret.client_secret = payment_intent.client_secret

        # User pledged, allow into the beta!
        if not user.invite_only_approved:
            user.invite_only_approved = True
            await user.save(session)

        return ret

    async def create_pledge_as_org(
        self,
        platform: Platforms,
        org: Organization,
        repo: Repository,
        issue: Issue,
        pledge: PledgeCreate,
        user: User,
        session: AsyncSession,
    ) -> PledgeMutationResponse:
        # Pre-authenticated pledge flow
        if not pledge.pledge_as_org:
            raise NotPermitted("Unexpected flow")

        pledge_as_org = await organization_service.get_by_id_for_user(
            session=session,
            platform=platform,
            org_id=pledge.pledge_as_org,
            user_id=user.id,
        )

        if not pledge_as_org:
            raise ResourceNotFound("Not found")

        # Create the pledge
        db_pledge = await self.create_db_pledge(
            session=session,
            issue=issue,
            repo=repo,
            org=org,
            pledge=pledge,
            by_organization=pledge_as_org,
        )

        # Note that we don't create a payment intent here, we create it off_session
        # when the user calls the API to confirm the pledge

        ret = PledgeMutationResponse.from_orm(db_pledge)

        return ret

    async def modify_pledge(
        self,
        platform: Platforms,
        session: AsyncSession,
        repo: Repository,
        user: User | None,
        pledge_id: UUID,
        updates: PledgeUpdate,
    ) -> PledgeMutationResponse:
        payment_intent = None

        pledge = await self.get(session=session, id=pledge_id)

        if not pledge or pledge.repository_id != repo.id:
            raise ResourceNotFound("Pledge not found")

        if updates.pledge_as_org and not user:
            raise NotPermitted("Logged-in user required")

        if updates.amount and updates.amount != pledge.amount:
            pledge.amount = updates.amount
            pledge.fee = self.calculate_fee(pledge.amount)
            if pledge.payment_id:
                # Some pledges (those created by orgs) don't have a payment intent
                payment_intent = stripe.modify_intent(
                    pledge.payment_id, amount=pledge.amount_including_fee
                )

        if updates.email and updates.email != pledge.email:
            pledge.email = updates.email

        if (
            user
            and updates.pledge_as_org
            and updates.pledge_as_org != pledge.organization_id
        ):
            pledge_as_org = await organization_service.get_by_id_for_user(
                session=session,
                platform=platform,
                org_id=updates.pledge_as_org,
                user_id=user.id,
            )
            if pledge_as_org:
                pledge.by_organization_id = pledge_as_org.id

        if payment_intent is None and pledge.payment_id:
            payment_intent = stripe.retrieve_intent(pledge.payment_id)

        await pledge.save(session=session)

        ret = PledgeMutationResponse.from_orm(pledge)
        if payment_intent:
            ret.client_secret = payment_intent.client_secret

        return ret

    async def confirm_pledge(
        self,
        session: AsyncSession,
        repo: Repository,
        pledge_id: UUID,
    ) -> PledgeMutationResponse:
        pledge = await self.get_with_loaded(session=session, pledge_id=pledge_id)

        if not pledge or pledge.repository_id != repo.id:
            raise ResourceNotFound("Pledge not found")

        if pledge.state not in PledgeState.to_created_states():
            raise Exception(f"pledge is in unexpected state: {pledge.state}")

        payment_intent = await stripe.create_confirmed_payment_intent_for_organization(
            session=session,
            organization=pledge.organization,
            amount=pledge.amount_including_fee,
            transfer_group=f"{pledge.id}",
            issue=pledge.issue,
        )

        pledge.state = PledgeState.created
        pledge.payment_id = payment_intent.id
        await pledge.save(session=session)

        return PledgeMutationResponse.from_orm(pledge)

    async def create_db_pledge(
        self,
        org: Organization,
        repo: Repository,
        issue: Issue,
        pledge: PledgeCreate,
        session: AsyncSession,
        by_user: User | None = None,
        by_organization: Organization | None = None,
    ) -> Pledge:
        return await Pledge.create(
            session=session,
            issue_id=issue.id,
            repository_id=repo.id,
            organization_id=org.id,
            email=pledge.email,
            amount=pledge.amount,
            fee=self.calculate_fee(pledge.amount),
            state=PledgeState.initiated,
            by_user_id=by_user and by_user.id or None,
            by_organization_id=by_organization and by_organization.id or None,
        )

    def calculate_fee(self, amount: int) -> int:
        # 2.9% + potentially 1.5% for international cards plus a fixed fee of 30 cents
        # See https://support.stripe.com/questions/passing-the-stripe-fee-on-to-customers
        fee_percentage = 0.029 + 0.015
        fee_fixed = 30
        return math.ceil((amount + fee_fixed) / (1 - fee_percentage)) - amount

    async def connect_backer(
        self,
        session: AsyncSession,
        pledge_id: UUID,
        backer: User,
    ) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")

        pledge.by_user_id = backer.id
        await pledge.save(session)

        # Approve the user for the alpha!
        backer.invite_only_approved = True
        await backer.save(session)

    async def mark_pending_by_issue_id(
        self, session: AsyncSession, issue_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(
                Pledge.issue_id == issue_id,
                Pledge.state.in_(PledgeState.to_pending_states()),
            )
            .values(
                state=PledgeState.pending,
                scheduled_payout_at=date.today() + timedelta(days=14),
            )
        )
        await session.execute(statement)
        await session.commit()

        # get and fire events
        pledges = await self.get_by_issue_ids(session, [issue_id])
        for p in pledges:
            await p.on_updated(session)

    async def mark_pending_by_pledge_id(
        self, session: AsyncSession, pledge_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(
                Pledge.id == pledge_id,
                Pledge.state.in_(PledgeState.to_pending_states()),
            )
            .values(
                state=PledgeState.pending,
                scheduled_payout_at=date.today() + timedelta(days=14),
            )
        )
        await session.execute(statement)
        await session.commit()

        # get pledge, call on_updated
        pledge = await self.get(session, pledge_id)
        if pledge:
            await pledge.on_updated(session)

    async def mark_created_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        if pledge.state not in PledgeState.to_created_states():
            raise Exception(f"pledge is in unexpected state: {pledge.state}")

        pledge.state = PledgeState.created
        session.add(pledge)
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.pledge,
                amount=amount,
                transaction_id=transaction_id,
            )
        )
        await session.commit()
        await pledge.on_updated(session)

        await self.pledge_created_discord_alert(session, pledge)

    async def mark_paid_by_pledge_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)

        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        if pledge.state not in PledgeState.to_created_states():
            raise Exception(f"pledge is in unexpected state: {pledge.state}")

        pledge.state = PledgeState.paid
        pledge.transfer_id = transaction_id
        session.add(pledge)
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.transfer,
                amount=amount,
                transaction_id=transaction_id,
            )
        )
        await session.commit()
        await pledge.on_updated(session)

    async def refund_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with payment_id: {payment_id}")

        if pledge.state in PledgeState.to_refunded_states():
            if amount == pledge.amount:
                pledge.state = PledgeState.refunded
            elif amount < pledge.amount:
                pledge.amount -= amount
            else:
                raise NotPermitted("Refunding error, unexpected amount!")
        else:
            raise NotPermitted("Refunding error, unexpected pledge status")

        session.add(pledge)
        session.add(
            PledgeTransaction(
                pledge_id=pledge.id,
                type=PledgeTransactionType.refund,
                amount=amount,
                transaction_id=transaction_id,
            )
        )
        await session.commit()
        await pledge.on_updated(session)

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
        await pledge.on_updated(session)

    async def transfer(self, session: AsyncSession, pledge_id: UUID) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state not in PledgeState.to_paid_states():
            raise NotPermitted("Pledge is not in pending state")
        if pledge.scheduled_payout_at and pledge.scheduled_payout_at > utc_now():
            raise NotPermitted(
                "Pledge is not ready for payput (still in dispute window)"
            )

        organization = await organization_service.get(
            session, id=pledge.organization_id
        )
        if organization is None or organization.account is None:
            raise NotPermitted("Organization has no account")

        organization_share = round(pledge.amount * 0.9)  # TODO: proper calculation
        transfer_id = account_service.transfer(
            session=session,
            account=organization.account,
            amount=organization_share,
            transfer_group=f"{pledge.id}",
        )

        if transfer_id is None:
            raise NotPermitted("Transfer failed")  # TODO: Better error

        await self.mark_paid_by_pledge_id(
            session, pledge.payment_id, organization_share, transfer_id
        )

    async def get_by_payment_id(
        self, session: AsyncSession, payment_id: str
    ) -> Pledge | None:
        return await Pledge.find_by(
            session=session,
            payment_id=payment_id,
        )

    async def set_issue_pledged_amount_sum(
        self,
        session: AsyncSession,
        issue_id: UUID,
    ) -> None:
        pledges = await self.get_by_issue_ids(session, issue_ids=[issue_id])

        summed = 0
        if pledges:
            summed = sum([p.amount for p in pledges])

        stmt = (
            sql.update(Issue)
            .where(Issue.id == issue_id)
            .values(pledged_amount_sum=summed)
        )

        await session.execute(stmt)
        await session.commit()

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

    async def pledge_created_discord_alert(self, session: AsyncSession, pledge: Pledge):
        if not settings.DISCORD_WEBHOOK_URL:
            return

        webhook = AsyncDiscordWebhook(
            url=settings.DISCORD_WEBHOOK_URL, content="New pledge"
        )

        issue = await issue_service.get_by_id(session, pledge.issue_id)
        if not issue:
            print("zegl no discord issue")
            return

        embed = DiscordEmbed(
            title="New pledge",
            description=f'A ${pledge.amount/100} pledge has been made towards "{issue.title}"',  # noqa: E501
            color="65280",
        )

        embed.add_embed_field(
            name="Backoffice",
            value="[Open](https://dashboard.polar.sh/backoffice/pledges)",
        )

        webhook.add_embed(embed)
        await webhook.execute()
        return


pledge = PledgeService(Pledge)
