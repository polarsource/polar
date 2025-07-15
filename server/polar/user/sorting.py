from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class UserSortProperty(StrEnum):
    created_at = "created_at"
    email = "email"


ListSorting = Annotated[
    list[Sorting[UserSortProperty]],
    Depends(SortingGetter(UserSortProperty, ["created_at"])),
]
