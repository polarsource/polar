from polar.integrations.stripe.service import stripe as stripe_service
from polar.models import ProcessorTransaction
from polar.models.processor_transaction import Processor
from polar.postgres import AsyncSession

from .repository import ProcessorTransactionRepository


class ProcessorTransactionService:
    async def sync_stripe(self, session: AsyncSession) -> None:
        repository = ProcessorTransactionRepository.from_session(session)
        latest_transactions = await repository.get_latest_by_processor(Processor.stripe)
        latest_processor_ids = {tx.processor_id for tx in latest_transactions}

        balance_transactions = await stripe_service.list_balance_transactions()
        async for balance_transaction in balance_transactions:
            # We reached the point where we have already synced all the fees
            if balance_transaction.id in latest_processor_ids:
                break
            await repository.create(
                ProcessorTransaction.from_stripe(balance_transaction)
            )


processor_transaction = ProcessorTransactionService()
