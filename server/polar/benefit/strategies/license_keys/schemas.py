from typing import Literal

from pydantic import Field, model_validator

from polar.kit.schemas import EmptyStrToNone, Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)


class BenefitLicenseKeyExpirationProperties(Schema):
    ttl: int = Field(gt=0)
    timeframe: Literal["year", "month", "day"]

    @model_validator(mode="after")
    def validate_ttl_range(self) -> "BenefitLicenseKeyExpirationProperties":
        max_values: dict[str, int] = {
            "year": 100,
            "month": 1200,
            "day": 36500,
        }
        max_val = max_values[self.timeframe]
        if self.ttl > max_val:
            raise ValueError(
                f"ttl value {self.ttl} exceeds the maximum of {max_val} for timeframe "
                f"'{self.timeframe}'."
            )
        return self


class BenefitLicenseKeyActivationCreateProperties(Schema):
    limit: int = Field(gt=0, le=50)
    enable_customer_admin: bool


class BenefitLicenseKeyActivationProperties(Schema):
    limit: int
    enable_customer_admin: bool


class BenefitLicenseKeysCreateProperties(Schema):
    prefix: EmptyStrToNone | None = None
    expires: BenefitLicenseKeyExpirationProperties | None = None
    activations: BenefitLicenseKeyActivationCreateProperties | None = None
    limit_usage: int | None = Field(gt=0, default=None)


class BenefitLicenseKeysProperties(Schema):
    prefix: str | None
    expires: BenefitLicenseKeyExpirationProperties | None
    activations: BenefitLicenseKeyActivationProperties | None
    limit_usage: int | None


class BenefitLicenseKeysSubscriberProperties(Schema):
    prefix: str | None
    expires: BenefitLicenseKeyExpirationProperties | None
    activations: BenefitLicenseKeyActivationProperties | None
    limit_usage: int | None


class BenefitLicenseKeysCreate(BenefitCreateBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysCreateProperties


class BenefitLicenseKeysUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysCreateProperties | None = None


class BenefitLicenseKeys(BenefitBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysProperties


class BenefitLicenseKeysSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.license_keys]
    properties: BenefitLicenseKeysSubscriberProperties
