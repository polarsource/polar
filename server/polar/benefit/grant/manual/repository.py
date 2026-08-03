from uuid import UUID

from sqlalchemy.orm import joinedload, selectinload

from polar.kit.repository import (
    Options,
    RepositoryBase,
    RepositorySoftDeletionIDMixin,
    RepositorySoftDeletionMixin,
)
from polar.models import Benefit, BenefitGrant, ManualGrant


class ManualGrantRepository(
    RepositorySoftDeletionIDMixin[ManualGrant, UUID],
    RepositorySoftDeletionMixin[ManualGrant],
    RepositoryBase[ManualGrant],
):
    model = ManualGrant

    def get_eager_options(self) -> Options:
        return (
            selectinload(ManualGrant.grants).options(
                joinedload(BenefitGrant.customer),
                joinedload(BenefitGrant.benefit).joinedload(Benefit.organization),
            ),
        )
