import uuid
from datetime import timedelta
from decimal import Decimal

from dramatiq import Retry
from polar_sdk.models import (
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
)

from polar.config import settings
from polar.event.repository import EventRepository
from polar.external_event.service import external_event as external_event_service
from polar.kit.utils import utc_now
from polar.models.external_event import ExternalEventSource
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    can_retry,
)

from .client import get_client
from .service import polar_self


@actor(actor_name="polar_self.create_customer", priority=TaskPriority.LOW)
async def create_customer(
    external_id: str,
    name: str,
    organization_id: str,
    product_id: str,
    owner_external_id: str,
    owner_email: str,
    owner_name: str,
) -> None:
    client = get_client()
    await client.create_customer(
        external_id=external_id,
        name=name,
        owner_external_id=owner_external_id,
        owner_email=owner_email,
        owner_name=owner_name,
    )
    await client.create_free_subscription(
        external_customer_id=external_id,
        product_id=product_id,
    )


@actor(actor_name="polar_self.create_free_subscription", priority=TaskPriority.LOW)
async def create_free_subscription(external_customer_id: str, product_id: str) -> None:
    await get_client().create_free_subscription(
        external_customer_id=external_customer_id,
        product_id=product_id,
    )


@actor(actor_name="polar_self.add_member", priority=TaskPriority.LOW)
async def add_member(
    external_customer_id: str, email: str, name: str, external_id: str
) -> None:
    from polar_sdk.models.polarerror import PolarError

    client = get_client()
    try:
        customer = await client.get_customer_by_external_id(external_customer_id)
    except PolarError as e:
        if e.status_code == 404 and can_retry():
            raise Retry(delay=1000) from e
        raise

    await client.add_member(
        customer_id=customer.id,
        email=email,
        name=name,
        external_id=external_id,
    )


@actor(actor_name="polar_self.remove_member", priority=TaskPriority.LOW)
async def remove_member(external_customer_id: str, external_id: str) -> None:
    from polar_sdk.models.polarerror import PolarError

    client = get_client()
    try:
        await client.get_member_by_external_id(
            external_customer_id=external_customer_id,
            external_id=external_id,
        )
    except PolarError as e:
        if e.status_code == 404 and can_retry():
            raise Retry(delay=1000) from e
        if e.status_code == 404:
            return
        raise

    await client.remove_member(
        external_customer_id=external_customer_id,
        external_id=external_id,
    )


@actor(actor_name="polar_self.delete_customer", priority=TaskPriority.LOW)
async def delete_customer(external_id: str) -> None:
    await get_client().delete_customer(external_id=external_id)


@actor(
    actor_name="polar_self.track_event_ingestion_v2",
    cron_trigger=CronTrigger.from_crontab("*/5 * * * *"),
    priority=TaskPriority.LOW,
)
async def track_event_ingestion() -> None:
    if not settings.POLAR_SELF_ENABLED:
        return
    self_organization_id = uuid.UUID(settings.POLAR_ORGANIZATION_ID)
    cutoff = utc_now() - timedelta(seconds=30)
    async with AsyncSessionMaker() as session:
        repository = EventRepository.from_session(session)
        last_flush = await repository.get_latest_polar_self_ingestion_timestamp(
            self_organization_id
        )
        counts = await repository.count_user_events_by_organization(
            after=last_flush,
            until=cutoff,
            exclude_organization_id=self_organization_id,
        )
    if not counts:
        return
    await get_client().track_event_ingestion(counts=counts, cutoff=cutoff)


@actor(
    actor_name="polar_self.track_organization_review_usage",
    priority=TaskPriority.LOW,
)
async def track_organization_review_usage(
    external_customer_id: str,
    review_context: str,
    vendor: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: str,
) -> None:
    await get_client().track_organization_review_usage(
        external_customer_id=external_customer_id,
        review_context=review_context,
        vendor=vendor,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=Decimal(cost_usd),
    )


@actor(actor_name="polar_self.webhook.benefit_grant.created", priority=TaskPriority.LOW)
async def webhook_benefit_grant_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookBenefitGrantCreatedPayload.model_validate(event.data)
            await polar_self.handle_benefit_grant_event(session, payload)


@actor(actor_name="polar_self.webhook.benefit_grant.updated", priority=TaskPriority.LOW)
async def webhook_benefit_grant_updated(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookBenefitGrantUpdatedPayload.model_validate(event.data)
            await polar_self.handle_benefit_grant_event(session, payload)


@actor(actor_name="polar_self.webhook.benefit_grant.revoked", priority=TaskPriority.LOW)
async def webhook_benefit_grant_revoked(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookBenefitGrantRevokedPayload.model_validate(event.data)
            await polar_self.handle_benefit_grant_event(session, payload)
