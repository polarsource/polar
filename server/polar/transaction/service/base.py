from polar.exceptions import PolarError
from polar.kit.services import ResourceServiceReader
from polar.models import Transaction


class RefundTransactionError(PolarError):
    ...


class BaseTransactionService(ResourceServiceReader[Transaction]):
    ...
