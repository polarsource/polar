import uuid
from datetime import timedelta
from decimal import Decimal
from typing import Any

from dramatiq import Retry
from polar_sdk.models import (
    WebhookBenefitGrantCreatedPayload,
    WebhookBenefitGrantRevokedPayload,
    WebhookBenefitGrantUpdatedPayload,
    WebhookOrderCreatedPayload,
    WebhookSubscriptionCanceledPayload,
    WebhookSubscriptionPastDuePayload,
    WebhookSubscriptionRevokedPayload,
)

from polar.config import settings
from polar.event.repository import EventRepository
from polar.external_event.service import external_event as external_event_service
from polar.integrations.plain.service import plain as plain_service
from polar.integrations.tinybird.service import count_user_events_by_organization
from polar.kit.utils import utc_now
from polar.models.external_event import ExternalEventSource
from polar.models.member import MemberRole
from polar.worker import (
    AsyncSessionMaker,
    CronTrigger,
    TaskPriority,
    actor,
    can_retry,
)

from .client import get_client
from .exceptions import PolarSelfInvoiceNotReady
from .service import polar_self


@actor(actor_name="polar_self.create_customer", priority=TaskPriority.LOW)
async def create_customer(
    external_id: str,
    name: str,
    slug: str,
    owner_external_id: str,
    owner_email: str,
    owner_name: str,
) -> None:
    client = get_client()
    await client.create_customer(
        external_id=external_id,
        name=name,
        slug=slug,
        owner_external_id=owner_external_id,
        owner_email=owner_email,
        owner_name=owner_name,
    )
    await plain_service.upsert_tenant(
        external_id=external_id,
        name=name,
        default_tier_external_id=settings.PLAIN_DEFAULT_TIER_EXTERNAL_ID,
    )
    await plain_service.upsert_customer(
        external_id=owner_external_id,
        email=owner_email,
    )
    await plain_service.add_customer_to_tenant(
        customer_external_id=owner_external_id,
        tenant_external_id=external_id,
    )


@actor(actor_name="polar_self.add_member", priority=TaskPriority.LOW)
async def add_member(
    external_customer_id: str,
    email: str,
    name: str,
    external_id: str,
    role: str = MemberRole.member.value,
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
        role=role,
    )
    await plain_service.upsert_customer(
        external_id=external_id,
        email=email,
    )
    await plain_service.add_customer_to_tenant(
        customer_external_id=external_id,
        tenant_external_id=external_customer_id,
    )


@actor(actor_name="polar_self.update_member", priority=TaskPriority.LOW)
async def update_member(external_customer_id: str, external_id: str, name: str) -> None:
    await get_client().update_member(
        external_customer_id=external_customer_id,
        external_id=external_id,
        name=name,
    )


@actor(actor_name="polar_self.update_customer_slug", priority=TaskPriority.LOW)
async def update_customer_slug(external_id: str, slug: str) -> None:
    client = get_client()
    customer = await client.get_customer_by_external_id_or_none(external_id)
    if customer is None:
        return
    metadata: dict[str, Any] = dict(customer.metadata) if customer.metadata else {}
    metadata["slug"] = slug
    await client.update_customer_metadata(external_id=external_id, metadata=metadata)


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
    await plain_service.remove_customer_from_tenant(
        customer_external_id=external_id,
        tenant_external_id=external_customer_id,
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
    counts = await count_user_events_by_organization(
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


@actor(
    actor_name="polar_self.track_compass_assistant_usage",
    priority=TaskPriority.LOW,
)
async def track_compass_assistant_usage(
    external_customer_id: str,
    vendor: str,
    model: str,
    input_tokens: int,
    output_tokens: int,
    cost_usd: str,
    usage_id: str,
) -> None:
    await get_client().track_compass_assistant_usage(
        external_customer_id=external_customer_id,
        vendor=vendor,
        model=model,
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        cost_usd=Decimal(cost_usd),
        usage_id=usage_id,
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


@actor(actor_name="polar_self.webhook.order.created", priority=TaskPriority.LOW)
async def webhook_order_created(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookOrderCreatedPayload.model_validate(event.data)
            try:
                await polar_self.handle_order_created_event(payload)
            except PolarSelfInvoiceNotReady as e:
                if can_retry():
                    raise Retry() from e
                raise


@actor(actor_name="polar_self.webhook.subscription.canceled", priority=TaskPriority.LOW)
async def webhook_subscription_canceled(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookSubscriptionCanceledPayload.model_validate(event.data)
            await polar_self.handle_subscription_canceled_event(payload)


@actor(actor_name="polar_self.webhook.subscription.past_due", priority=TaskPriority.LOW)
async def webhook_subscription_past_due(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookSubscriptionPastDuePayload.model_validate(event.data)
            await polar_self.handle_subscription_past_due_event(payload)


@actor(actor_name="polar_self.webhook.subscription.revoked", priority=TaskPriority.LOW)
async def webhook_subscription_revoked(event_id: uuid.UUID) -> None:
    async with AsyncSessionMaker() as session:
        async with external_event_service.handle(
            session, ExternalEventSource.polar, event_id
        ) as event:
            payload = WebhookSubscriptionRevokedPayload.model_validate(event.data)
            await polar_self.handle_subscription_revoked_event(payload)
