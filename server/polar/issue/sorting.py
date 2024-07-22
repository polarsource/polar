from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class SortProperty(StrEnum):
    created_at = "created_at"
    modified_at = "modified_at"
    engagement = "engagement"
    positive_reactions = "positive_reactions"


ListSorting = Annotated[
    list[Sorting[SortProperty]],
    Depends(SortingGetter(SortProperty, ["-modified_at"])),
]
