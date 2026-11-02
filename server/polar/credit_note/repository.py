from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import CreditNote, Order


class CreditNoteRepository(
    RepositorySoftDeletionIDMixin[CreditNote, UUID],
    RepositorySoftDeletionMixin[CreditNote],
    RepositoryBase[CreditNote],
):
    model = CreditNote

    def get_eager_options(self) -> Options:
        return (
            joinedload(CreditNote.order).joinedload(Order.organization),
            joinedload(CreditNote.order).joinedload(Order.customer),
            selectinload(CreditNote.items),
            selectinload(CreditNote.refunds),
        )
