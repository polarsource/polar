from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class MemberSortProperty(StrEnum):
    created_at = "created_at"
    email = "email"
    member_name = "name"  # `name` is a reserved word, so we use `member_name`


ListSorting = Annotated[
    list[Sorting[MemberSortProperty]],
    Depends(SortingGetter(MemberSortProperty, ["-created_at"])),
]
