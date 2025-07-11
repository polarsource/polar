from polar.kit.repository.base import RepositoryBase
from polar.models import ProcessorTransaction
from polar.models.processor_transaction import Processor


class ProcessorTransactionRepository(RepositoryBase[ProcessorTransaction]):
    model = ProcessorTransaction

    async def get_latest_by_processor(
        self, processor: Processor
    ) -> ProcessorTransaction | None:
        statement = (
            self.get_base_statement()
            .where(ProcessorTransaction.processor == processor)
            .order_by(ProcessorTransaction.timestamp.desc())
            .limit(1)
        )
        return await self.get_one_or_none(statement)
