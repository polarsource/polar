from uuid import UUID

from polar.worker import AsyncSessionMaker, TaskPriority, actor

from .service import merchant_migration as merchant_migration_service


@actor(actor_name="merchant_migration.verify_cards", priority=TaskPriority.LOW)
async def merchant_migration_verify_cards(
    merchant_migration_id: UUID, offset: int = 0
) -> None:
    """Link the moved cards to the imported subscriptions, one batch per run."""
    async with AsyncSessionMaker() as session:
        await merchant_migration_service.run_card_verification(
            session, merchant_migration_id, offset=offset
        )
