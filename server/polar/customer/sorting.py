from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CustomerSortProperty(StrEnum):
    created_at = "created_at"
    email = "email"
    customer_name = "name"  # `name` is a reserved word, so we use `customer_name`


ListSorting = Annotated[
    list[Sorting[CustomerSortProperty]],
    Depends(SortingGetter(CustomerSortProperty, ["-created_at"])),
]
