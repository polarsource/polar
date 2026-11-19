from typing import Annotated, Literal

from pydantic import UUID4, AwareDatetime, ConfigDict, Field, StringConstraints

from polar.kit.external_id import ExternalID
from polar.kit.schemas import BENEFIT_ID_EXAMPLE, CUSTOMER_ID_EXAMPLE, Schema
from polar.models.license_key import LicenseKeyStatus
from polar.organization.schemas import OrganizationID


class BenefitGrantUpdate(Schema):
    manually_revoked_at: None = Field(
        default=None,
        description="Set to None to undo a manual revocation.",
        examples=[None],
    )


class BenefitGrantLicenseKeyCreate(Schema):
    """An existing license key to issue instead of generating one, for example
    when moving customers from another provider."""

    model_config = ConfigDict(extra="forbid")

    key: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
    ] = Field(
        description="The license key, issued exactly as given.",
        examples=["38B1460A-5104-4067-A91D-77B872934D51"],
    )
    status: Literal[LicenseKeyStatus.granted, LicenseKeyStatus.disabled] = Field(
        default=LicenseKeyStatus.granted,
        description="Whether the key starts out usable or disabled.",
    )
    expires_at: AwareDatetime | None = Field(
        default=None,
        description=(
            "When the key expires. If not set, the key never expires: the "
            "benefit's expiration doesn't apply to a provided key."
        ),
    )
    limit_activations: int | None = Field(
        default=None,
        gt=0,
        description=(
            "How many devices can activate the key. "
            "If not set, the benefit's activation limit applies."
        ),
    )


class BenefitGrantCreate(Schema):
    """Manually grant a benefit using Polar IDs."""

    model_config = ConfigDict(extra="forbid")

    customer_id: UUID4 = Field(
        description="The ID of the customer.",
        examples=[CUSTOMER_ID_EXAMPLE],
    )
    benefit_id: UUID4 = Field(
        description="The ID of the benefit.",
        examples=[BENEFIT_ID_EXAMPLE],
    )
    member_id: UUID4 | None = Field(
        default=None,
        description=(
            "The ID of the member receiving the benefit. "
            "If not provided, the benefit is granted to the customer's owner."
        ),
    )
    license_key: BenefitGrantLicenseKeyCreate | None = Field(
        default=None,
        description=(
            "An existing license key to issue. "
            "Only for license key benefits; otherwise Polar generates one."
        ),
    )


class BenefitGrantCreateExternal(Schema):
    """Manually grant a benefit using external IDs."""

    model_config = ConfigDict(extra="forbid")

    external_customer_id: str = Field(
        min_length=1,
        description="The ID of the customer in your system.",
        examples=["usr_1337"],
    )
    external_benefit_id: ExternalID = Field(
        description=(
            "The ID of the benefit in your system. "
            "Resolves to the current version of the benefit."
        ),
        examples=["ext_1337"],
    )
    external_member_id: str | None = Field(
        default=None,
        min_length=1,
        description=(
            "The ID of the member in your system, scoped to the customer. "
            "If not provided, the benefit is granted to the customer's owner."
        ),
    )
    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the customer and benefit. "
            "**Required unless your credential identifies one organization.** "
            "Omit this field when using an organization token."
        ),
    )
    license_key: BenefitGrantLicenseKeyCreate | None = Field(
        default=None,
        description=(
            "An existing license key to issue. "
            "Only for license key benefits; otherwise Polar generates one."
        ),
    )
