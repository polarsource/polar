from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class RepositorySortProperty(StrEnum):
    created_at = "created_at"
    name = "name"
    stars = "stars"


ListSorting = Annotated[
    list[Sorting[RepositorySortProperty]],
    Depends(SortingGetter(RepositorySortProperty, ["-created_at"])),
]
