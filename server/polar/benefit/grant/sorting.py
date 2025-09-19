from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class BenefitGrantSortProperty(StrEnum):
    created_at = "created_at"
    granted_at = "granted_at"
    revoked_at = "revoked_at"


ListSorting = Annotated[
    list[Sorting[BenefitGrantSortProperty]],
    Depends(SortingGetter(BenefitGrantSortProperty, ["-created_at"])),
]
