from typing import Annotated, Literal

from pydantic import Field

from polar.enums import PaymentProcessor
from polar.kit.schemas import Schema, SetSchemaReference

from . import schemas


class RequiredPaymentProcessorMixin(Schema):
    payment_processor: Literal[PaymentProcessor.stripe] = Field(
        description="Payment processor to use. Currently only Stripe is supported."
    )


class CheckoutLinkCreateProductPrice(
    RequiredPaymentProcessorMixin, schemas.CheckoutLinkCreateProductPrice
):
    __doc__ = schemas.CheckoutLinkCreateProductPrice.__doc__


class CheckoutLinkCreateProduct(
    RequiredPaymentProcessorMixin, schemas.CheckoutLinkCreateProduct
):
    __doc__ = schemas.CheckoutLinkCreateProduct.__doc__


class CheckoutLinkCreateProducts(
    RequiredPaymentProcessorMixin, schemas.CheckoutLinkCreateProducts
):
    __doc__ = schemas.CheckoutLinkCreateProducts.__doc__


CheckoutLinkCreate = Annotated[
    CheckoutLinkCreateProductPrice
    | CheckoutLinkCreateProduct
    | CheckoutLinkCreateProducts,
    SetSchemaReference("CheckoutLinkCreate"),
]
