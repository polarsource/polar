from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class BenefitSortProperty(StrEnum):
    created_at = "created_at"
    description = "description"
    type = "type"
    user_order = "user_order"


ListSorting = Annotated[
    list[Sorting[BenefitSortProperty]],
    Depends(SortingGetter(BenefitSortProperty, ["-created_at"])),
]
