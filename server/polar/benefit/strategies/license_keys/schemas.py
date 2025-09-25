from typing import Literal

from pydantic import Field

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
