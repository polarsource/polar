from collections.abc import Sequence

from polar.kit.repository.base import RepositoryBase
from polar.models import ProcessorTransaction
from polar.models.processor_transaction import Processor


class ProcessorTransactionRepository(RepositoryBase[ProcessorTransaction]):
    model = ProcessorTransaction

    async def get_latest_by_processor(
        self, processor: Processor
    ) -> Sequence[ProcessorTransaction]:
        latest_timestamp_statement = (
            self.get_base_statement()
            .where(ProcessorTransaction.processor == processor)
            .order_by(ProcessorTransaction.timestamp.desc())
            .limit(1)
        )
        latest_transaction = await self.get_one_or_none(latest_timestamp_statement)

        if latest_transaction is None:
            return []

        statement = self.get_base_statement().where(
            ProcessorTransaction.processor == processor,
            ProcessorTransaction.timestamp == latest_transaction.timestamp,
        )
        return await self.get_all(statement)
