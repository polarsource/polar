import uuid
from decimal import Decimal

from polar.config import settings
from polar.worker import enqueue_job


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


polar_self = PolarSelfService()
