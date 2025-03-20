from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class BenefitSortProperty(StrEnum):
    created_at = "created_at"
    description = "description"


ListSorting = Annotated[
    list[Sorting[BenefitSortProperty]],
    Depends(SortingGetter(BenefitSortProperty, ["-created_at"])),
]
