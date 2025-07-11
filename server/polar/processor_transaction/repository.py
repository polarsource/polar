from polar.kit.repository.base import RepositoryBase
from polar.models import ProcessorTransaction


class ProcessorTransactionRepository(RepositoryBase[ProcessorTransaction]):
    model = ProcessorTransaction
