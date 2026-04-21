from decimal import Decimal

from dramatiq import Retry

from polar.worker import TaskPriority, actor, can_retry

from .client import get_client


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


@actor(actor_name="polar_self.track_event_ingestion", priority=TaskPriority.LOW)
async def track_event_ingestion(
    external_customer_id: str, count: int, organization_id: str
) -> None:
    await get_client().track_event_ingestion(
        external_customer_id=external_customer_id,
        count=count,
    )


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
