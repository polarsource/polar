from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CatalogMigrationSortProperty(StrEnum):
    created_at = "created_at"


ListSorting = Annotated[
    list[Sorting[CatalogMigrationSortProperty]],
    Depends(SortingGetter(CatalogMigrationSortProperty, ["-created_at"])),
]
