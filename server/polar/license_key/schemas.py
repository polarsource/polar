from datetime import datetime
from typing import Any

from pydantic import UUID4, Field

from polar.benefit.schemas import BenefitID
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.schemas import Schema
from polar.models.license_key import LicenseKeyStatus

###############################################################################
# RESPONSES
###############################################################################

NotFoundResponse = {
    "description": "License key not found.",
    "model": ResourceNotFound.schema(),
}

UnauthorizedResponse = {
    "description": "Not authorized to manage license key.",
    "model": Unauthorized.schema(),
}


###############################################################################
# RESPONSES
###############################################################################


class LicenseKeyValidate(Schema):
    key: str
    activation_id: UUID4 | None = None
    benefit_id: BenefitID | None = None
    user_id: UUID4 | None = None
    increment_usage: int | None = None


class LicenseKeyActivate(Schema):
    key: str
    label: str
    meta: dict[str, Any] = {}


class LicenseKeyDeactivate(Schema):
    key: str
    activation_id: UUID4


class LicenseKeyRead(Schema):
    id: UUID4
    user_id: UUID4
    benefit_id: BenefitID
    key: str
    status: LicenseKeyStatus
    limit_activations: int | None = None
    usage: int
    limit_usage: int | None = None
    validations: int
    last_validated_at: datetime | None = None
    expires_at: datetime | None = None


class LicenseKeyActivationBase(Schema):
    id: UUID4
    license_key_id: UUID4
    label: str
    meta: dict[str, Any]


class LicenseKeyWithActivations(LicenseKeyRead):
    activations: list[LicenseKeyActivationBase]


class ValidatedLicenseKey(LicenseKeyRead):
    activation: LicenseKeyActivationBase | None = None


class LicenseKeyActivationRead(LicenseKeyActivationBase):
    license_key: LicenseKeyRead


class LicenseKeyUpdate(Schema):
    status: LicenseKeyStatus | None = None
    usage: int = 0
    limit_activations: int | None = Field(gt=0, le=50, default=None)
    limit_usage: int | None = Field(gt=0, default=None)
    expires_at: datetime | None = None


class LicenseKeyCreate(LicenseKeyUpdate):
    user_id: UUID4
    benefit_id: BenefitID
    key: str
