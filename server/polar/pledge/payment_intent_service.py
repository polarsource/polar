from __future__ import annotations

import stripe.error as stripe_lib_error
import structlog

from polar.exceptions import NotPermitted, ResourceNotFound, StripeError
from polar.integrations.stripe.service import stripe
from polar.issue.service import issue as issue_service
from polar.models.issue import Issue
from polar.models.pledge import Pledge
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.postgres import AsyncSession, sql
from polar.repository.service import repository as repository_service

from .schemas import (
    PledgeState,
    PledgeStripePaymentIntentCreate,
    PledgeStripePaymentIntentMutationResponse,
    PledgeStripePaymentIntentUpdate,
)
from .service import pledge as pledge_service

log = structlog.get_logger()


class PaymentIntentService:
    async def create_payment_intent(
        self,
        user: User | None,
        intent: PledgeStripePaymentIntentCreate,
        issue: Issue,
        session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        if user:
            return await self.create_user_payment_intent(
                issue=issue,
                intent=intent,
                user=user,
                session=session,
            )

        return await self.create_anonymous_payment_intent(
            issue,
            intent,
        )

    async def create_anonymous_payment_intent(
        self,
        issue: Issue,
        intent: PledgeStripePaymentIntentCreate,
    ) -> PledgeStripePaymentIntentMutationResponse:
        if not intent.email:
            raise NotPermitted("pledge.email is required for anonymous pledges")

        amount = intent.amount
        fee = self.calculate_fee(intent.amount)
        amount_including_fee = amount + fee

        # Create a payment intent with Stripe
        try:
            payment_intent = stripe.create_anonymous_intent(
                amount=amount_including_fee,
                transfer_group=str(intent.issue_id),
                issue=issue,
                anonymous_email=intent.email,
            )
        except stripe_lib_error.InvalidRequestError as e:
            raise StripeError("Invalid Stripe Request") from e

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            amount=amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret,
        )

    async def create_user_payment_intent(
        self,
        issue: Issue,
        intent: PledgeStripePaymentIntentCreate,
        user: User,
        session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        amount = intent.amount
        fee = self.calculate_fee(intent.amount)
        amount_including_fee = amount + fee

        # Create a payment intent with Stripe
        payment_intent = await stripe.create_user_intent(
            session=session,
            amount=amount_including_fee,
            transfer_group=str(intent.issue_id),
            issue=issue,
            user=user,
        )

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            amount=amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret,
        )

    async def update_payment_intent(
        self,
        payment_intent_id: str,
        updates: PledgeStripePaymentIntentUpdate,
    ) -> PledgeStripePaymentIntentMutationResponse:
        fee = self.calculate_fee(updates.amount)
        amount_including_fee = updates.amount + fee

        payment_intent = stripe.modify_intent(
            payment_intent_id,
            amount=amount_including_fee,
            receipt_email=updates.email,
            setup_future_usage=updates.setup_future_usage,
        )

        return PledgeStripePaymentIntentMutationResponse(
            payment_intent_id=payment_intent.id,
            amount=updates.amount,
            fee=fee,
            amount_including_fee=amount_including_fee,
            client_secret=payment_intent.client_secret if payment_intent else None,
        )

    async def create_pledge(
        self,
        payment_intent_id: str,
        session: AsyncSession,
    ) -> Pledge:
        # If we alredy have a pledge created from this payment intent, return the
        # existing peldge and do nothing.
        pledge = await pledge_service.get_by_payment_id(
            session, payment_id=payment_intent_id
        )
        if pledge:
            return pledge

        intent = stripe.retrieve_intent(payment_intent_id)
        if not intent:
            raise ResourceNotFound()

        issue_id = intent["metadata"]["issue_id"]

        issue = await issue_service.get(session, issue_id)
        if not issue:
            raise ResourceNotFound()

        org = await organization_service.get(session, issue.organization_id)
        if not org:
            raise ResourceNotFound()

        repo = await repository_service.get(session, issue.repository_id)
        if not repo:
            raise ResourceNotFound()

        email = intent["receipt_email"]
        amount = intent["amount"]
        user_id = intent["metadata"].get("user_id", None)

        state = (
            PledgeState.created
            if intent["status"] == "succeeded"
            else PledgeState.initiated
        )

        return await Pledge.create(
            session=session,
            payment_id=payment_intent_id,
            issue_id=issue.id,
            repository_id=repo.id,
            organization_id=org.id,
            email=email,
            amount=amount,
            fee=0,
            state=state,
            by_user_id=user_id,
            by_organization_id=None,
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
