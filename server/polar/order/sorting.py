from enum import StrEnum
from typing import Annotated

from fastapi import Depends

from polar.kit.sorting import Sorting, SortingGetter


class OrderSortProperty(StrEnum):
    created_at = "created_at"
    status = "status"
    invoice_number = "invoice_number"
    amount = "amount"
    net_amount = "net_amount"
    customer = "customer"
    product = "product"
    discount = "discount"
    subscription = "subscription"


ListSorting = Annotated[
    list[Sorting[OrderSortProperty]],
    Depends(SortingGetter(OrderSortProperty, ["-created_at"])),
]
