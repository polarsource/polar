from typing import Literal, TypedDict

from ..base.properties import BenefitGrantProperties, BenefitProperties


class BenefitLicenseKeyExpirationProperties(TypedDict):
    ttl: int
    timeframe: Literal["year", "month", "day"]


class BenefitLicenseKeyActivationProperties(TypedDict):
    limit: int
    enable_customer_admin: bool


class BenefitLicenseKeysProperties(BenefitProperties):
    prefix: str | None
    expires: BenefitLicenseKeyExpirationProperties | None
    activations: BenefitLicenseKeyActivationProperties | None
    limit_usage: int | None


class BenefitGrantLicenseKeyTermsProperties(TypedDict):
    """A provided key's own terms. They replace the benefit's expiration and,
    when set, its activation limit."""

    status: str
    expires_at: str | None
    limit_activations: int | None


class BenefitGrantLicenseKeysProperties(BenefitGrantProperties, total=False):
    user_provided_key: str
    license_key_id: str
    display_key: str


class BenefitGrantLicenseKeysStoredProperties(
    BenefitGrantLicenseKeysProperties, total=False
):
    """What a grant stores. The provided key's terms stay internal: the public
    grant properties above are part of every API version."""

    user_provided_terms: BenefitGrantLicenseKeyTermsProperties
