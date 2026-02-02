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


class BenefitGrantLicenseKeysProperties(BenefitGrantProperties, total=False):
    user_provided_key: str
    license_key_id: str
    display_key: str
