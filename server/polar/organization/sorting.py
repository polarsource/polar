from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class OrganizationSortProperty(StrEnum):
    created_at = "created_at"
    slug = "slug"
    organization_name = (
        "name"  # `name` is a reserved word, so we use `organization_name`
    )
    next_review_threshold = "next_review_threshold"
    days_in_status = "days_in_status"


ListSorting = Annotated[
    list[Sorting[OrganizationSortProperty]],
    Depends(SortingGetter(OrganizationSortProperty, ["created_at"])),
]
