from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class MeterSortProperty(StrEnum):
    created_at = "created_at"
    meter_name = "name"  # `name` is a reserved word, so we use `meter_name`


ListSorting = Annotated[
    list[Sorting[MeterSortProperty]],
    Depends(SortingGetter(MeterSortProperty, ["meter"])),
]
