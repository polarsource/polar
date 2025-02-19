from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class OrganizationAccessTokenSortProperty(StrEnum):
    created_at = "created_at"
    comment = "comment"
    last_used_at = "last_used_at"
    organization_id = "organization_id"


ListSorting = Annotated[
    list[Sorting[OrganizationAccessTokenSortProperty]],
    Depends(SortingGetter(OrganizationAccessTokenSortProperty, ["created_at"])),
]
