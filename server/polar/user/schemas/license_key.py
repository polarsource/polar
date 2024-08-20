from datetime import datetime
from typing import Any

from pydantic import UUID4, Field

from polar.benefit.schemas import BenefitID
from polar.kit.schemas import Schema
from polar.models.license_key import LicenseKeyStatus


class LicenseKeyValidationScopes(Schema):
    benefit_id: BenefitID | None = None
    user_id: UUID4 | None = None


class LicenseKeyValidate(Schema):
    scope: LicenseKeyValidationScopes | None = None
    key: str


class LicenseKeyActivate(Schema):
    key: str
    label: str
    meta: dict[str, Any] = {}


class LicenseKeyRead(Schema):
    id: UUID4
    user_id: UUID4
    benefit_id: BenefitID
    key: str
    status: LicenseKeyStatus
    limit_activations: int | None = None
    expires_at: datetime | None = None


class LicenseKeyActivationRead(Schema):
    id: UUID4
    license_key_id: UUID4
    label: str
    meta: dict[str, Any]
    license_key: LicenseKeyRead


class LicenseKeyCreate(Schema):
    user_id: UUID4
    benefit_id: BenefitID
    key: str
    status: LicenseKeyStatus
    limit_activations: int | None = Field(gt=0, le=50, default=None)
    expires_at: datetime | None = None


class LicenseKeyUpdate(LicenseKeyCreate): ...
