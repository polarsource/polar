from typing import Annotated

from polar.kit.schemas import SetSchemaReference

from .schemas import (
    CheckoutLinkCreateProduct,
    CheckoutLinkCreateProductPrice,
    CheckoutLinkCreateProducts,
)

CheckoutLinkCreate = Annotated[
    CheckoutLinkCreateProductPrice
    | CheckoutLinkCreateProduct
    | CheckoutLinkCreateProducts,
    SetSchemaReference("CheckoutLinkCreate"),
]
