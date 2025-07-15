from pydantic import Field

from polar.benefit.schemas import BenefitPublic
from polar.file.schemas import ProductMediaFileRead
from polar.kit.schemas import Schema
from polar.organization.schemas import Organization
from polar.product.schemas import ProductBase, ProductPrice


class ProductStorefront(ProductBase):
    """Schema of a public product."""

    prices: list[ProductPrice] = Field(
        description="List of available prices for this product."
    )
    benefits: list[BenefitPublic] = Field(
        title="BenefitPublic", description="The benefits granted by the product."
    )
    medias: list[ProductMediaFileRead] = Field(
        description="The medias associated to the product."
    )


class StorefrontCustomer(Schema):
    name: str


class StorefrontCustomers(Schema):
    total: int
    customers: list[StorefrontCustomer]


class Storefront(Schema):
    """Schema of a public storefront."""

    organization: Organization
    products: list[ProductStorefront]
    donation_product: ProductStorefront | None
    customers: StorefrontCustomers


class OrganizationSlugLookup(Schema):
    """Schema for organization slug lookup response."""

    organization_slug: str = Field(
        description="The slug of the organization that owns the product or subscription."
    )
