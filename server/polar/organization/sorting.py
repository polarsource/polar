from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class OrganizationSortProperty(StrEnum):
    created_at = "created_at"
    name = "name"


ListSorting = Annotated[
    list[Sorting[OrganizationSortProperty]],
    Depends(SortingGetter(OrganizationSortProperty, ["created_at"])),
]
