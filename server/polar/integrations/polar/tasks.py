from polar.worker import TaskPriority, actor

from .client import get_client


@actor(actor_name="polar_self.create_customer", priority=TaskPriority.LOW)
async def create_customer(
    external_id: str, email: str, name: str, organization_id: str, product_id: str
) -> None:
    await get_client().create_customer(
        external_id=external_id,
        email=email,
        name=name,
        organization_id=organization_id,
    )


@actor(actor_name="polar_self.create_free_subscription", priority=TaskPriority.LOW)
async def create_free_subscription(external_customer_id: str, product_id: str) -> None:
    await get_client().create_free_subscription(
        external_customer_id=external_customer_id,
        product_id=product_id,
    )


@actor(actor_name="polar_self.add_member", priority=TaskPriority.LOW)
async def add_member(customer_id: str, email: str, name: str, external_id: str) -> None:
    await get_client().add_member(
        customer_id=customer_id,
        email=email,
        name=name,
        external_id=external_id,
    )


@actor(actor_name="polar_self.remove_member", priority=TaskPriority.LOW)
async def remove_member(member_id: str) -> None:
    await get_client().remove_member(member_id=member_id)


@actor(actor_name="polar_self.track_event_ingestion", priority=TaskPriority.LOW)
async def track_event_ingestion(
    external_customer_id: str, count: int, organization_id: str
) -> None:
    await get_client().track_event_ingestion(
        external_customer_id=external_customer_id,
        count=count,
        organization_id=organization_id,
    )
