from uuid import UUID

from polar.kit.repository import RepositoryBase, RepositoryIDMixin
from polar.models import DiscountRedemption


class DiscountRedemptionRepository(
    RepositoryBase[DiscountRedemption], RepositoryIDMixin[DiscountRedemption, UUID]
):
    model = DiscountRedemption
