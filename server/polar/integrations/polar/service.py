import uuid
from decimal import Decimal
from typing import TYPE_CHECKING, Any

import logfire
from polar_sdk.models import (
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
)

from polar.account.repository import AccountRepository
from polar.config import settings
from polar.exceptions import PolarError
from polar.postgres import AsyncSession
from polar.worker import enqueue_job

from .client import get_client

if TYPE_CHECKING:
    from polar_sdk.models import BenefitGrant, Customer


BenefitGrantWebhookPayload = (
    WebhookBenefitGrantCreatedPayload
    | WebhookBenefitGrantUpdatedPayload
    | WebhookBenefitGrantRevokedPayload
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

    async def handle_benefit_grant_event(
        self, session: AsyncSession, payload: BenefitGrantWebhookPayload
    ) -> None:
        grant = payload.data
        metadata = grant.benefit.metadata or {}
        benefit_type = metadata.get("type")

        organization_id = self._resolve_organization_id(grant.customer)

        with logfire.span(
            "polar_self.webhook.benefit_grant",
            event_type=payload.TYPE,
            benefit_id=grant.benefit_id,
            benefit_type=benefit_type,
            organization_id=str(organization_id),
        ):
            if not isinstance(benefit_type, str) or benefit_type not in (
                "transaction_fee",
                "support",
            ):
                return

            active_grant = await self._fetch_active_grant(
                grant.customer_id, benefit_type
            )

            match benefit_type:
                case "transaction_fee":
                    await self._apply_transaction_fee(
                        session, organization_id, active_grant
                    )
                case "support":
                    await self._apply_support(session, organization_id, active_grant)

    def _resolve_organization_id(self, customer: "Customer") -> uuid.UUID:
        raw = customer.external_id
        if not isinstance(raw, str):
            raise PolarSelfWebhookError(f"Customer {customer.id} has no external_id")
        try:
            return uuid.UUID(raw)
        except ValueError as e:
            raise PolarSelfWebhookError(
                f"Customer external_id is not a UUID: {raw!r}"
            ) from e

    def _extract_transaction_fee(
        self, metadata: dict[str, Any], benefit_id: str
    ) -> tuple[int, int]:
        return (
            self._parse_int_metadata(metadata, "fee_percent", benefit_id),
            self._parse_int_metadata(metadata, "fee_fixed", benefit_id),
        )

    def _parse_int_metadata(
        self, metadata: dict[str, Any], field: str, benefit_id: str
    ) -> int:
        value = metadata.get(field)
        if isinstance(value, bool):
            raise TransactionFeeBenefitError(
                f"Benefit {benefit_id} has invalid {field}: {value!r}"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError as e:
                raise TransactionFeeBenefitError(
                    f"Benefit {benefit_id} has invalid {field}: {value!r}"
                ) from e
        raise TransactionFeeBenefitError(
            f"Benefit {benefit_id} has invalid {field}: {value!r}"
        )

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
            fee_percent, fee_fixed = None, None
        else:
            fee_percent, fee_fixed = self._extract_transaction_fee(
                grant.benefit.metadata or {}, grant.benefit_id
            )

        # Inline: account.service → user_organization.service → this module.
        from polar.account.service import account as account_service

        with logfire.span(
            "polar_self.webhook.transaction_fee.applied",
            organization_id=str(organization_id),
            fee_percent=fee_percent,
            fee_fixed=fee_fixed,
        ):
            await account_service.set_platform_fee(
                session,
                account,
                fee_percent=fee_percent,
                fee_fixed=fee_fixed,
            )

    def _extract_support(
        self, metadata: dict[str, Any], benefit_id: str
    ) -> tuple[int, bool, bool]:
        level = self._parse_support_level(metadata, benefit_id)
        slack = self._parse_bool_metadata(metadata, "slack", benefit_id)
        prioritized = self._parse_bool_metadata(metadata, "prioritized", benefit_id)
        return level, slack, prioritized

    def _parse_support_level(self, metadata: dict[str, Any], benefit_id: str) -> int:
        value = metadata.get("level")
        if isinstance(value, bool):
            raise SupportBenefitError(
                f"Benefit {benefit_id} has invalid level: {value!r}"
            )
        if isinstance(value, int):
            return value
        if isinstance(value, float) and value.is_integer():
            return int(value)
        if isinstance(value, str):
            try:
                return int(value)
            except ValueError as e:
                raise SupportBenefitError(
                    f"Benefit {benefit_id} has invalid level: {value!r}"
                ) from e
        raise SupportBenefitError(f"Benefit {benefit_id} has invalid level: {value!r}")

    def _parse_bool_metadata(
        self, metadata: dict[str, Any], field: str, benefit_id: str
    ) -> bool:
        value = metadata.get(field)
        if isinstance(value, bool):
            return value
        if value == "true":
            return True
        if value == "false":
            return False
        raise SupportBenefitError(
            f"Benefit {benefit_id} has invalid {field}: {value!r}"
        )

    async def _apply_support(
        self,
        session: AsyncSession,
        organization_id: uuid.UUID,
        grant: "BenefitGrant | None",
    ) -> None:
        if grant is None:
            level: int | None = None
            slack: bool | None = None
            prioritized: bool | None = None
        else:
            level, slack, prioritized = self._extract_support(
                grant.benefit.metadata or {}, grant.benefit_id
            )

        # TODO: persist once support tier fields exist on the org/account.
        logfire.info(
            "polar_self.webhook.support.applied",
            organization_id=str(organization_id),
            level=level,
            slack=slack,
            prioritized=prioritized,
        )

    async def _fetch_active_grant(
        self, customer_id: str, benefit_type: str
    ) -> "BenefitGrant | None":
        grants = await get_client().list_customer_benefit_grants(
            customer_id=customer_id
        )
        matching = [
            grant
            for grant in grants
            if (grant.benefit.metadata or {}).get("type") == benefit_type
        ]
        if len(matching) > 1:
            benefit_ids = [grant.benefit_id for grant in matching]
            raise PolarSelfWebhookError(
                f"Customer {customer_id} holds {len(matching)} active "
                f"{benefit_type!r} benefit grants, expected at most 1: {benefit_ids}"
            )
        return matching[0] if matching else None


polar_self = PolarSelfService()
