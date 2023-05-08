from __future__ import annotations

from uuid import UUID
from typing import List, Sequence

import structlog
from polar.enums import Platforms

from polar.kit.services import ResourceService
from polar.integrations.stripe.service import stripe
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge_transaction import PledgeTransaction
from polar.models.repository import Repository
from polar.models.user import User
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession, sql
from sqlalchemy.orm import (
    joinedload,
)
from polar.organization.service import organization as organization_service
from polar.account.service import account as account_service
from polar.exceptions import ResourceNotFound, NotPermitted

from .schemas import PledgeCreate, PledgeMutationResponse, PledgeTransactionType, PledgeUpdate, PledgeState

log = structlog.get_logger()


class PledgeService(ResourceService[Pledge, PledgeCreate, PledgeUpdate]):
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
                Pledge.state.in_(PledgeState.active_states())
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
                Pledge.state.in_(PledgeState.active_states()))
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
                Pledge.state.in_(PledgeState.active_states())
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
    ) ->  PledgeMutationResponse:
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
        session: AsyncSession,
        repo: Repository,
        pledge_id: UUID,
        updates: PledgeUpdate
    ) -> PledgeMutationResponse:
        payment_intent = None

        pledge = await self.get(session=session, id=pledge_id)

        if not pledge or pledge.repository_id != repo.id:
            raise ResourceNotFound('Pledge not found')

        if updates.amount and updates.amount != pledge.amount:
            pledge.amount = updates.amount
            pledge.fee = self.calculate_fee(pledge.amount)
            payment_intent = stripe.modify_intent(pledge.payment_id,
                                                  amount=pledge.amount_including_fee)

        if updates.email and updates.email != pledge.email:
            pledge.email = updates.email

        if payment_intent is None:
            payment_intent = stripe.retrieve_intent(pledge.payment_id)

        await pledge.save(session=session)

        ret = PledgeMutationResponse.from_orm(pledge)
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
            raise ResourceNotFound('Pledge not found')

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

        ret = PledgeMutationResponse.from_orm(pledge)

        return ret

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
            by_user=by_user and by_user.id or None,
            by_organization_id=by_organization and by_organization.id or None,
        )

    def calculate_fee(self, amount: int) -> int:
        return round(amount * 0.029 + 30)

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
            .where(Pledge.issue_id == issue_id, Pledge.state == PledgeState.created)
            .values(state=PledgeState.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def mark_pending_by_pledge_id(
        self, session: AsyncSession, pledge_id: UUID
    ) -> None:
        statement = (
            sql.update(Pledge)
            .where(Pledge.id == pledge_id, Pledge.state == PledgeState.created)
            .values(state=PledgeState.pending)
        )
        await session.execute(statement)
        await session.commit()

    async def mark_created_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
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

    async def mark_paid_by_pledge_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            pledge.state = PledgeState.paid
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

    async def refund_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            if pledge.state in [PledgeState.created, PledgeState.pending]:
                if amount == pledge.amount:
                    pledge.state = PledgeState.refunded
                elif amount < pledge.amount:
                    pledge.amount -= amount
                else:
                    # Not possible
                    ...
            else:
                # TODO: Log to sentry
                ...

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

    async def mark_disputed_by_payment_id(
        self, session: AsyncSession, payment_id: str, amount: int, transaction_id: str
    ) -> None:
        pledge = await self.get_by_payment_id(session, payment_id)
        if pledge:
            pledge.state = PledgeState.disputed
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

    async def transfer(self, session: AsyncSession, pledge_id: UUID) -> None:
        pledge = await self.get(session, id=pledge_id)
        if not pledge:
            raise ResourceNotFound(f"Pledge not found with id: {pledge_id}")
        if pledge.state != PledgeState.pending:
            raise NotPermitted("Pledge is not in pending state")

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


pledge = PledgeService(Pledge)
