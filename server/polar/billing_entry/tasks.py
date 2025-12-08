import uuid

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .repository import BillingEntryRepository


@actor(actor_name="billing_entry.set_order_item", priority=TaskPriority.LOW)
async def set_order_item(
    billing_entries: list[uuid.UUID], order_item_id: uuid.UUID
) -> None:
    """
    🚮 Unused as of 2025-12-08, you can remove me safely if I'm still there by 2026-01-01.
    """
    async with AsyncSessionMaker() as session:
        repository = BillingEntryRepository.from_session(session)
        await repository.update_order_item_id(billing_entries, order_item_id)
