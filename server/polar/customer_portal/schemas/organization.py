from typing import Self

from pydantic import Field, model_validator

from polar.benefit.schemas import BenefitPublic
from polar.file.schemas import ProductMediaFileRead
from polar.kit.schemas import Schema
from polar.models.organization import OrganizationCustomerPortalSettings
from polar.organization.schemas import (
    OrganizationPublicBase,
)
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


class CustomerOrganizationFeatureSettings(Schema):
    """Feature flags exposed to the customer portal."""

    member_model_enabled: bool = Field(
        default=False,
        description="Whether the member model is enabled for this organization.",
    )


class CustomerOrganization(OrganizationPublicBase):
    customer_portal_settings: OrganizationCustomerPortalSettings = Field(
        description="Settings related to the customer portal",
    )
    organization_features: CustomerOrganizationFeatureSettings = Field(
        default_factory=CustomerOrganizationFeatureSettings,
        description="Feature flags for the customer portal.",
    )

    @model_validator(mode="after")
    def _set_organization_features(self) -> Self:
        if self.feature_settings is not None:
            self.organization_features = CustomerOrganizationFeatureSettings(
                member_model_enabled=self.feature_settings.member_model_enabled,
            )
        return self


class CustomerOrganizationData(Schema):
    """Schema of an organization and related data for customer portal."""

    organization: CustomerOrganization
    products: list[CustomerProduct]
