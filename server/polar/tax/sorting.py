from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class TaxJurisdictionSortProperty(StrEnum):
    tax_amount = "tax_amount"
    order_count = "order_count"
    country = "country"


ListSorting = Annotated[
    list[Sorting[TaxJurisdictionSortProperty]],
    Depends(SortingGetter(TaxJurisdictionSortProperty, ["-tax_amount"])),
]
