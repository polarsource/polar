from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class CustomerCustomerMeterSortProperty(StrEnum):
    created_at = "created_at"
    modified_at = "modified_at"
    meter_id = "meter_id"
    meter_name = "meter_name"
    consumed_units = "consumed_units"
    credited_units = "credited_units"
    balance = "balance"


ListSorting = Annotated[
    list[Sorting[CustomerCustomerMeterSortProperty]],
    Depends(SortingGetter(CustomerCustomerMeterSortProperty, ["-modified_at"])),
]
