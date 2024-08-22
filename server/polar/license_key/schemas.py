from datetime import datetime
from typing import Any, Literal, Self

from dateutil.relativedelta import relativedelta
from pydantic import UUID4, Field, model_validator

from polar.benefit.schemas import BenefitID
from polar.exceptions import ResourceNotFound, Unauthorized
from polar.kit.schemas import Schema
from polar.kit.utils import generate_uuid, utc_now
from polar.models.benefit import BenefitLicenseKeyExpiration
from polar.models.license_key import LicenseKey, LicenseKeyStatus

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
    display_key: str
    status: LicenseKeyStatus
    limit_activations: int | None = None
    usage: int
    limit_usage: int | None = None
    validations: int
    last_validated_at: datetime | None = None
    expires_at: datetime | None = None

    @model_validator(mode="before")
    @classmethod
    def generate_display_key(cls, data: dict[str, Any]) -> dict[str, Any]:
        if isinstance(data, LicenseKey):
            data = data.__dict__

        prefix = "****"
        last_six_digits = data["key"][-6:]
        data["display_key"] = f"{prefix}-{last_six_digits}"
        return data


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
    organization_id: UUID4
    user_id: UUID4
    benefit_id: BenefitID
    key: str

    @classmethod
    def generate_key(cls, prefix: str | None = None) -> str:
        key = str(generate_uuid()).upper()
        if prefix is None:
            return key

        prefix = prefix.strip().upper()
        return f"{prefix}-{key}"

    @classmethod
    def generate_expiration_dt(
        cls, ttl: int, timeframe: Literal["year", "month", "day"]
    ) -> datetime:
        now = utc_now()
        match timeframe:
            case "year":
                return now + relativedelta(years=ttl)
            case "month":
                return now + relativedelta(months=ttl)
            case _:
                return now + relativedelta(days=ttl)

    @classmethod
    def build(
        cls,
        organization_id: UUID4,
        user_id: UUID4,
        benefit_id: UUID4,
        prefix: str | None = None,
        status: LicenseKeyStatus = LicenseKeyStatus.granted,
        limit_activations: int | None = None,
        limit_usage: int | None = None,
        expires: BenefitLicenseKeyExpiration | None = None,
    ) -> Self:
        expires_at = None
        if expires:
            ttl = expires.get("ttl", None)
            timeframe = expires.get("timeframe", None)
            if ttl and timeframe:
                expires_at = cls.generate_expiration_dt(ttl, timeframe)

        key = cls.generate_key(prefix=prefix)
        return cls(
            organization_id=organization_id,
            user_id=user_id,
            benefit_id=benefit_id,
            key=key,
            status=status,
            limit_activations=limit_activations,
            limit_usage=limit_usage,
            expires_at=expires_at,
        )
