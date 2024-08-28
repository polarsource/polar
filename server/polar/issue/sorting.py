from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class IssueSortProperty(StrEnum):
    created_at = "created_at"
    modified_at = "modified_at"
    engagement = "engagement"
    positive_reactions = "positive_reactions"
    funding_goal = "funding_goal"


ListSorting = Annotated[
    list[Sorting[IssueSortProperty]],
    Depends(SortingGetter(IssueSortProperty, ["-modified_at"])),
]
