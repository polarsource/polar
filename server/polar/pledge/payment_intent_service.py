from __future__ import annotations

from typing import cast

import stripe.error as stripe_lib_error
import structlog

from polar.exceptions import NotPermitted, ResourceNotFound, StripeError
from polar.integrations.loops.service import loops as loops_service
from polar.integrations.stripe.schemas import PaymentIntentMetadata
from polar.integrations.stripe.service import stripe
from polar.issue.service import issue as issue_service
from polar.models.issue import Issue
from polar.models.organization import Organization
from polar.models.pledge import Pledge
from polar.models.repository import Repository
from polar.models.user import User
from polar.organization.service import organization as organization_service
from polar.pledge.hooks import PledgeHook, pledge_created
from polar.postgres import AsyncSession
from polar.repository.service import repository as repository_service
from polar.user.service import user as user_service

from .schemas import (
    PledgeState,
    PledgeStripePaymentIntentCreate,
    PledgeStripePaymentIntentMutationResponse,
    PledgeStripePaymentIntentUpdate,
    PledgeType,
)
from .service import pledge as pledge_service

log = structlog.get_logger()


class PaymentIntentService:
    async def create_payment_intent(
        self,
        *,
        user: User | None,
        intent: PledgeStripePaymentIntentCreate,
        pledge_issue: Issue,
        pledge_issue_org: Organization,
        pledge_issue_repo: Repository,
        session: AsyncSession,
    ) -> PledgeStripePaymentIntentMutationResponse:
        if user:
            return await self.create_user_payment_intent(
                pledge_issue=pledge_issue,
                pledge_issue_org=pledge_issue_org,
                pledge_issue_repo=pledge_issue_repo,
                intent=intent,
                user=user,
                session=session,
            )

        return await self.create_anonymous_payment_intent(
            pledge_issue=pledge_issue,
            pledge_issue_org=pledge_issue_org,
            pledge_issue_repo=pledge_issue_repo,
            intent=intent,
        )

    async def create_anonymous_payment_intent(
        self,
        *,
        pledge_issue: Issue,
        pledge_issue_org: Organization,
        pledge_issue_repo: Repository,
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
                pledge_issue=pledge_issue,
                pledge_issue_org=pledge_issue_org,
                pledge_issue_repo=pledge_issue_repo,
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
        *,
        pledge_issue: Issue,
        pledge_issue_org: Organization,
        pledge_issue_repo: Repository,
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
            pledge_issue=pledge_issue,
            pledge_issue_org=pledge_issue_org,
            pledge_issue_repo=pledge_issue_repo,
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
            on_behalf_of_organization_id=updates.on_behalf_of_organization_id,
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

        metadata = PaymentIntentMetadata.parse_obj(intent["metadata"])

        issue_id = metadata.issue_id
        if not issue_id:
            raise ResourceNotFound("issue_id is not set")

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

        user_id = metadata.user_id

        # Create an account automatically for anonymous pledges
        if user_id is None:
            user = await user_service.get_by_email_or_signup(session, email)
            user_id = user.id
        else:
            user = cast(User, await user_service.get(session, user_id))
        await loops_service.user_update(user, isBacker=True)

        state = (
            PledgeState.created
            if intent["status"] == "succeeded"
            else PledgeState.initiated
        )

        pledge = await Pledge.create(
            session=session,
            payment_id=payment_intent_id,
            issue_id=issue.id,
            repository_id=repo.id,
            organization_id=org.id,
            email=email,
            amount=amount,
            fee=0,
            state=state,
            type=PledgeType.pay_upfront,
            by_user_id=user_id,
            by_organization_id=None,
            on_behalf_of_organization_id=metadata.on_behalf_of_organization_id,
        )

        if state == PledgeState.created:
            await pledge_created.call(PledgeHook(session, pledge))

        await pledge_service.after_pledge_created(
            session, pledge, issue, authenticated_user=None
        )

        return pledge

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
