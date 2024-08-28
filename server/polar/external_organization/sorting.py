from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class ExternalOrganizationSortProperty(StrEnum):
    created_at = "created_at"
    name = "name"


ListSorting = Annotated[
    list[Sorting[ExternalOrganizationSortProperty]],
    Depends(SortingGetter(ExternalOrganizationSortProperty, ["-created_at"])),
]
