from uuid import UUID

from polar.kit.repository import (
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CreditNote


class CreditNoteRepository(
    RepositorySoftDeletionIDMixin[CreditNote, UUID],
    RepositorySoftDeletionMixin[CreditNote],
    RepositoryBase[CreditNote],
):
    model = CreditNote
