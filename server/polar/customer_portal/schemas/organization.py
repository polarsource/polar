from pydantic import Field

from polar.benefit.schemas import BenefitPublic
from polar.file.schemas import ProductMediaFileRead
from polar.kit.schemas import Schema
from polar.organization.schemas import Organization
from polar.product.schemas import ProductBase, ProductPrice


class CustomerProduct(ProductBase):
    """Schema of a product for customer portal."""

    prices: list[ProductPrice] = Field(
        description="List of available prices for this product."
    )
    benefits: list[BenefitPublic] = Field(
        title="BenefitPublic", description="The benefits granted by the product."
    )
    medias: list[ProductMediaFileRead] = Field(
        description="The medias associated to the product."
    )


class CustomerOrganization(Schema):
    """Schema of an organization and related data for customer portal."""

    organization: Organization
    products: list[CustomerProduct]
