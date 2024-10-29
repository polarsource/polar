from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CustomFieldSortProperty(StrEnum):
    created_at = "created_at"
    slug = "slug"
    custom_field_name = (
        "name"  # `name` is a reserved word, so we use `custom_field_name`
    )
    type = "type"


ListSorting = Annotated[
    list[Sorting[CustomFieldSortProperty]],
    Depends(SortingGetter(CustomFieldSortProperty, ["slug"])),
]
