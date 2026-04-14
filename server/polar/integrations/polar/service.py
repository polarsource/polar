import uuid

from polar.config import settings
from polar.worker import enqueue_job


class PolarSelfService:
    INITIAL_MEMBER_DELAY_MS = 1000

    @property
    def is_configured(self) -> bool:
        return settings.POLAR_SELF_ENABLED

    def enqueue_create_customer(
        self, *, organization_id: uuid.UUID, email: str, name: str
    ) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.create_customer",
            external_id=str(organization_id),
            email=email,
            name=name,
            organization_id=settings.POLAR_ORGANIZATION_ID,
            product_id=settings.POLAR_FREE_PRODUCT_ID,
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

    def enqueue_track_ingestion(self, *, external_customer_id: str, count: int) -> None:
        if not self.is_configured:
            return
        enqueue_job(
            "polar_self.track_event_ingestion",
            external_customer_id=external_customer_id,
            count=count,
            organization_id=settings.POLAR_ORGANIZATION_ID,
        )


polar_self = PolarSelfService()
