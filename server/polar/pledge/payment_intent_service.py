from __future__ import annotations

import stripe.error as stripe_lib_error
import structlog

from polar.exceptions import NotPermitted, StripeError
from polar.integrations.stripe.service import stripe
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.postgres import AsyncSession

from .schemas import (
    PledgeState,
    PledgeStripePaymentIntentCreate,
    PledgeStripePaymentIntentMutationResponse,
    PledgeStripePaymentIntentUpdate,
)

log = structlog.get_logger()


class PaymentIntentService:
    async def create_payment_intent(
        self,
        user: User | None,
        pledge: PledgeStripePaymentIntentCreate,
        org: Organization,
        repo: Repository,
        issue: Issue,
        session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        # Pledge flow with logged in user
        # if user:
        #     return await self.create_pledge_user(
        #         org,
        #         repo,
        #         issue,
        #         pledge,
        #         user,
        #         session,
        #     )

        return await self.create_anonymous_payment_intent(
            # org,
            # repo,
            issue,
            pledge,
            # session,
        )

    async def create_anonymous_payment_intent(
        self,
        # org: Organization,
        # repo: Repository,
        issue: Issue,
        create: PledgeStripePaymentIntentCreate,
        # session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        if not create.email:
            raise NotPermitted("pledge.email is required for anonymous pledges")

        # Create the pledge
        # db_pledge = await self.create_db_pledge(
        #     session=session,
        #     issue=issue,
        #     repo=repo,
        #     org=org,
        #     pledge=pledge,
        # )

        amount = create.amount
        fee = self.calculate_fee(create.amount)
        amount_including_fee = amount + fee

        # Create a payment intent with Stripe
        try:
            payment_intent = stripe.create_anonymous_intent(
                amount=amount_including_fee,
                transfer_group=str(create.issue_id),
                issue=issue,
                anonymous_email=create.email,
            )
        except stripe_lib_error.InvalidRequestError as e:
            raise StripeError("Invalid Stripe Request") from e

        # Store the intent id
        # db_pledge.payment_id = payment_intent.id
        # await db_pledge.save(session)

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            amount=amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret,
            # pledge_id=db_pledge.id,
            # state=PledgeState.from_str(db_pledge.state),
            # fee=db_pledge.fee,
            # amount_including_fee=db_pledge.amount_including_fee,
            # client_secret=payment_intent.client_secret,
        )

    async def create_user_payment_intent(
        self,
        # org: Organization,
        # repo: Repository,
        issue: Issue,
        create: PledgeStripePaymentIntentCreate,
        user: User,
        session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        # # Create the pledge
        # db_pledge = await self.create_db_pledge(
        #     session=session,
        #     issue=issue,
        #     repo=repo,
        #     org=org,
        #     pledge=pledge,
        #     by_user=user,
        # )

        amount = create.amount
        fee = self.calculate_fee(create.amount)
        amount_including_fee = amount + fee

        # Create a payment intent with Stripe
        payment_intent = await stripe.create_user_intent(
            session=session,
            amount=amount_including_fee,
            transfer_group=str(create.issue_id),
            issue=issue,
            user=user,
        )

        # Store the intent id
        # db_pledge.payment_id = payment_intent.id
        # await db_pledge.save(session)

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            # pledge_id=db_pledge.id,
            # state=PledgeState.from_str(db_pledge.state),
            amount=amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret,
        )

    async def update_payment_intent(
        self,
        session: AsyncSession,
        # repo: Repository,
        user: User | None,
        payment_intent_id: str,
        updates: PledgeStripePaymentIntentUpdate,
    ) -> PledgeStripePaymentIntentMutationResponse:
        fee = self.calculate_fee(updates.amount)
        amount_including_fee = updates.amount + fee

        payment_intent = stripe.modify_intent(
            payment_intent_id,
            amount=amount_including_fee,
            email=updates.email,
        )

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            amount=updates.amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret if payment_intent else None,
        )

    async def create_db_pledge(
        self,
        org: Organization,
        repo: Repository,
        issue: Issue,
        pledge: PledgeStripePaymentIntentCreate,
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

    @classmethod
    def calculate_fee(cls, amount: int) -> int:
        # 2.9% + potentially 1.5% for international cards plus a fixed fee of 30 cents
        # See https://support.stripe.com/questions/passing-the-stripe-fee-on-to-customers
        # fee_percentage = 0.029 + 0.015
        # fee_fixed = 30
        # return math.ceil((amount + fee_fixed) / (1 - fee_percentage)) - amount

        # Running free service fees for a bit
        return 0


payment_intent_service = PaymentIntentService()
