from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CheckoutLinkSortProperty(StrEnum):
    created_at = "created_at"
    label = "label"
    success_url = "success_url"
    allow_discount_codes = "allow_discount_codes"


ListSorting = Annotated[
    list[Sorting[CheckoutLinkSortProperty]],
    Depends(SortingGetter(CheckoutLinkSortProperty, ["created_at"])),
]
