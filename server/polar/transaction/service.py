from polar.kit.services import ResourceServiceReader
from polar.models import Transaction


class TransactionService(ResourceServiceReader[Transaction]):
    ...


transaction = TransactionService(Transaction)
