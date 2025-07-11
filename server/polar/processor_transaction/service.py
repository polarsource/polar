from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import ProcessorTransaction
from polar.models.processor_transaction import Processor
from polar.postgres import AsyncSession

from .repository import ProcessorTransactionRepository


class ProcessorTransactionService:
    async def sync_stripe(self, session: AsyncSession) -> None:
        repository = ProcessorTransactionRepository.from_session(session)
        latest = await repository.get_latest_by_processor(Processor.stripe)
        balance_transactions = await stripe_service.list_balance_transactions()
        async for balance_transaction in balance_transactions:
            # We reached the point where we have already synced all the fees
            if latest is not None and latest.processor_id == balance_transaction.id:
                break
            await repository.create(
                ProcessorTransaction.from_stripe(balance_transaction)
            )


processor_transaction = ProcessorTransactionService()
