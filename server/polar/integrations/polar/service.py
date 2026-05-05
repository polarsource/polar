import uuid
from collections import defaultdict
from decimal import Decimal
from typing import TYPE_CHECKING

import logfire
from polar_sdk.models import (
    WebhookSubscriptionActivePayload,
    WebhookSubscriptionRevokedPayload,
    WebhookSubscriptionUpdatedPayload,
)

from polar.account.repository import AccountRepository
from polar.config import settings
from polar.exceptions import PolarError
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .client import get_client

if TYPE_CHECKING:
    from polar_sdk.models import BenefitGrant, Subscription


SubscriptionWebhookPayload = (
    WebhookSubscriptionActivePayload
    | WebhookSubscriptionUpdatedPayload
    | WebhookSubscriptionRevokedPayload
)


class PolarSelfWebhookError(PolarError): ...


class TransactionFeeBenefitError(PolarSelfWebhookError): ...


class SupportBenefitError(PolarSelfWebhookError): ...


class PolarSelfService:
    INITIAL_MEMBER_DELAY_MS = 1000

    @property
    def is_configured(self) -> bool:
        return settings.POLAR_SELF_ENABLED

    def enqueue_create_customer(
        self,
        *,
        organization_id: uuid.UUID,
        name: str,
        owner_external_id: str,
        owner_email: str,
        owner_name: str,
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.create_customer",
            external_id=str(organization_id),
            name=name,
            organization_id=settings.POLAR_ORGANIZATION_ID,
            product_id=settings.POLAR_FREE_PRODUCT_ID,
            owner_external_id=owner_external_id,
            owner_email=owner_email,
            owner_name=owner_name,
        )

    def enqueue_add_member(
        self,
        *,
        external_customer_id: str,
        email: str,
        name: str,
        external_id: str,
        delay: int | None = None,
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.add_member",
            delay=delay,
            external_customer_id=external_customer_id,
            email=email,
            name=name,
            external_id=external_id,
        )

    def enqueue_remove_member(
        self, *, external_customer_id: str, external_id: str
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.remove_member",
            external_customer_id=external_customer_id,
            external_id=external_id,
        )

    def enqueue_delete_customer(self, *, organization_id: uuid.UUID) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.delete_customer",
            external_id=str(organization_id),
        )

    def enqueue_track_organization_review_usage(
        self,
        *,
        external_customer_id: str,
        review_context: str,
        vendor: str,
        model: str,
        input_tokens: int,
        output_tokens: int,
        cost_usd: Decimal | float | None,
    ) -> None:
        if not self.is_configured:
            return
        if external_customer_id == settings.POLAR_ORGANIZATION_ID:
            return
        if cost_usd is None:
            return
        cost_decimal = Decimal(str(cost_usd))
        if cost_decimal <= 0:
            return
        enqueue_job(
            "polar_self.track_organization_review_usage",
            external_customer_id=external_customer_id,
            review_context=review_context,
            vendor=vendor,
            model=model,
            input_tokens=input_tokens,
            output_tokens=output_tokens,
            cost_usd=str(cost_decimal),
        )

    async def handle_subscription_event(
        self, session: AsyncSession, payload: SubscriptionWebhookPayload
    ) -> None:
        subscription = payload.data
        grants = await get_client().list_customer_benefit_grants(
            customer_id=subscription.customer_id
        )
        grouped = self._group_benefit_grants_by_metadata_type(grants)

        logfire.info(
            "polar_self.webhook.subscription.benefits",
            subscription_id=subscription.id,
            customer_id=subscription.customer_id,
            event_type=payload.TYPE,
            types=sorted(t for t in grouped if t is not None),
        )

        organization_id = self._resolve_organization_id(subscription, grouped)
        if organization_id is None:
            return

        await self._apply_transaction_fee(
            session, organization_id, grouped.get("transaction_fee")
        )
        await self._apply_support(session, organization_id, grouped.get("support"))

    def _resolve_organization_id(
        self,
        subscription: "Subscription",
        grouped: "dict[str | None, BenefitGrant]",
    ) -> uuid.UUID | None:
        raw = subscription.customer.external_id
        if not isinstance(raw, str):
            if grouped:
                raise PolarSelfWebhookError(
                    "Customer has no external_id but holds benefit grants: "
                    f"{sorted(t for t in grouped if t is not None)}"
                )
            return None

        try:
            return uuid.UUID(raw)
        except ValueError as e:
            raise PolarSelfWebhookError(
                f"Customer external_id is not a UUID: {raw!r}"
            ) from e

    def _group_benefit_grants_by_metadata_type(
        self,
        grants: list["BenefitGrant"],
    ) -> "dict[str | None, BenefitGrant]":
        grouped: dict[str | None, list[BenefitGrant]] = defaultdict(list)
        for grant in grants:
            metadata = grant.benefit.metadata or {}
            type_value = metadata.get("type")
            key = type_value if isinstance(type_value, str) else None
            grouped[key].append(grant)

        single: dict[str | None, BenefitGrant] = {}
        for key, type_grants in grouped.items():
            if len(type_grants) > 1:
                benefit_ids = [grant.benefit_id for grant in type_grants]
                raise PolarSelfWebhookError(
                    f"Customer holds {len(type_grants)} benefit grants of "
                    f"type {key!r}, expected at most 1: {benefit_ids}"
                )
            single[key] = type_grants[0]
        return single

    def _extract_transaction_fee(
        self,
        grant: "BenefitGrant",
    ) -> tuple[int, int]:
        metadata = grant.benefit.metadata or {}
        take_rate = metadata.get("take_rate")
        flat_fee_in_cents = metadata.get("flat_fee_in_cents")
        if not isinstance(take_rate, int) or isinstance(take_rate, bool):
            raise TransactionFeeBenefitError(
                f"Benefit {grant.benefit_id} has invalid take_rate: {take_rate!r}"
            )
        if not isinstance(flat_fee_in_cents, int) or isinstance(
            flat_fee_in_cents, bool
        ):
            raise TransactionFeeBenefitError(
                f"Benefit {grant.benefit_id} has invalid "
                f"flat_fee_in_cents: {flat_fee_in_cents!r}"
            )
        return take_rate, flat_fee_in_cents

    async def _apply_transaction_fee(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        account_repository = AccountRepository.from_session(session)
        account = await account_repository.get_by_organization(organization_id)
        if account is None:
            return

        if grant is None:
            take_rate, flat_fee_in_cents = None, None
        else:
            take_rate, flat_fee_in_cents = self._extract_transaction_fee(grant)

        # Inline: account.service → user_organization.service → this module.
        from polar.account.service import account as account_service

        with logfire.span(
            "polar_self.webhook.transaction_fee.applied",
            organization_id=str(organization_id),
            take_rate=take_rate,
            flat_fee_in_cents=flat_fee_in_cents,
        ):
            await account_service.set_platform_fee(
                session,
                account,
                take_rate=take_rate,
                flat_fee_in_cents=flat_fee_in_cents,
            )

    def _extract_support(
        self,
        grant: "BenefitGrant",
    ) -> tuple[int, bool, bool]:
        metadata = grant.benefit.metadata or {}
        level = metadata.get("level")
        slack = metadata.get("slack")
        prioritized = metadata.get("prioritized")
        if not isinstance(level, int) or isinstance(level, bool):
            raise SupportBenefitError(
                f"Benefit {grant.benefit_id} has invalid level: {level!r}"
            )
        if not isinstance(slack, bool):
            raise SupportBenefitError(
                f"Benefit {grant.benefit_id} has invalid slack: {slack!r}"
            )
        if not isinstance(prioritized, bool):
            raise SupportBenefitError(
                f"Benefit {grant.benefit_id} has invalid prioritized: {prioritized!r}"
            )
        return level, slack, prioritized

    async def _apply_support(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        if grant is None:
            level, slack, prioritized = None, None, None
        else:
            level, slack, prioritized = self._extract_support(grant)

        # TODO: persist once support tier fields exist on the org/account.
        logfire.info(
            "polar_self.webhook.support.applied",
            organization_id=str(organization_id),
            level=level,
            slack=slack,
            prioritized=prioritized,
        )


polar_self = PolarSelfService()
