from datetime import datetime
from typing import Annotated, Literal, Self

from dateutil.relativedelta import relativedelta
from pydantic import UUID4, AliasChoices, AliasPath, Field
from pydantic.json_schema import SkipJsonSchema

from polar.benefit.schemas import BenefitID
from polar.benefit.strategies.license_keys.properties import (
    BenefitLicenseKeyActivationProperties,
    BenefitLicenseKeyExpirationProperties,
)
from polar.customer.schemas.customer import CustomerBase
from polar.exceptions import NotPermitted, ResourceNotFound, Unauthorized
from polar.kit.metadata import (
    MAXIMUM_KEYS,
    METADATA_DESCRIPTION,
    MetadataKey,
    MetadataValue,
)
from polar.kit.schemas import IDSchema, Schema, TimestampedSchema
from polar.kit.utils import generate_uuid, utc_now
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


ActivationNotPermitted = {
    "description": "License key activation not supported or limit reached. Use /validate endpoint for licenses without activations.",
    "model": NotPermitted.schema(),
}


###############################################################################
# RESPONSES
###############################################################################

ConditionsField = Annotated[
    dict[MetadataKey, MetadataValue],
    Field(
        default_factory=dict,
        max_length=MAXIMUM_KEYS,
        description=METADATA_DESCRIPTION.format(
            heading=(
                "Key-value object allowing you to set conditions "
                "that must match when validating the license key."
            )
        ),
    ),
]

MetaField = Annotated[
    dict[MetadataKey, MetadataValue],
    Field(
        default_factory=dict,
        max_length=MAXIMUM_KEYS,
        description=METADATA_DESCRIPTION.format(
            heading=(
                "Key-value object allowing you to store additional information "
                "about the activation"
            )
        ),
    ),
]


class LicenseKeyValidate(Schema):
    key: str
    organization_id: UUID4
    activation_id: UUID4 | None = None
    benefit_id: BenefitID | None = None
    customer_id: UUID4 | None = None
    increment_usage: int | None = None
    conditions: ConditionsField


class LicenseKeyActivate(Schema):
    key: str
    organization_id: UUID4
    label: str
    conditions: ConditionsField
    meta: MetaField


class LicenseKeyDeactivate(Schema):
    key: str
    organization_id: UUID4
    activation_id: UUID4


class LicenseKeyCustomer(CustomerBase): ...


class LicenseKeyUser(Schema):
    id: UUID4 = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_id",
            # Validate from stored webhook payload
            "id",
        )
    )
    email: str
    public_name: str = Field(
        validation_alias=AliasChoices(
            # Validate from ORM model
            "legacy_user_public_name",
            # Validate from stored webhook payload
            "public_name",
        )
    )
    avatar_url: str | None = Field(None)


class LicenseKeyRead(TimestampedSchema, IDSchema):
    organization_id: UUID4
    user_id: SkipJsonSchema[UUID4] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user_id",
            # Validate from ORM model
            AliasPath("customer", "legacy_user_id"),
        ),
        deprecated="Use `customer_id`.",
    )
    customer_id: UUID4
    user: SkipJsonSchema[LicenseKeyUser] = Field(
        validation_alias=AliasChoices(
            # Validate from stored webhook payload
            "user",
            # Validate from ORM model
            "customer",
        ),
        deprecated="Use `customer`.",
    )
    customer: LicenseKeyCustomer
    benefit_id: BenefitID
    key: str
    display_key: str
    status: LicenseKeyStatus
    limit_activations: int | None
    usage: int
    limit_usage: int | None
    validations: int
    last_validated_at: datetime | None
    expires_at: datetime | None


class LicenseKeyActivationBase(Schema):
    id: UUID4
    license_key_id: UUID4
    label: str
    meta: dict[str, str | int | float | bool]
    created_at: datetime
    modified_at: datetime | None


class LicenseKeyWithActivations(LicenseKeyRead):
    activations: list[LicenseKeyActivationBase]


class ValidatedLicenseKey(LicenseKeyRead):
    activation: LicenseKeyActivationBase | None = None


class LicenseKeyActivationRead(LicenseKeyActivationBase):
    license_key: LicenseKeyRead


class LicenseKeyUpdate(Schema):
    status: LicenseKeyStatus | None = None
    usage: int = 0
    limit_activations: int | None = Field(gt=0, le=1000, default=None)
    limit_usage: int | None = Field(gt=0, default=None)
    expires_at: datetime | None = None


class LicenseKeyCreate(LicenseKeyUpdate):
    organization_id: UUID4
    customer_id: UUID4
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
        customer_id: UUID4,
        benefit_id: UUID4,
        prefix: str | None = None,
        status: LicenseKeyStatus = LicenseKeyStatus.granted,
        limit_usage: int | None = None,
        activations: BenefitLicenseKeyActivationProperties | None = None,
        expires: BenefitLicenseKeyExpirationProperties | None = None,
    ) -> Self:
        expires_at = None
        if expires:
            ttl = expires.get("ttl", None)
            timeframe = expires.get("timeframe", None)
            if ttl and timeframe:
                expires_at = cls.generate_expiration_dt(ttl, timeframe)

        limit_activations = None
        if activations:
            limit_activations = activations.get("limit", None)

        key = cls.generate_key(prefix=prefix)
        return cls(
            organization_id=organization_id,
            customer_id=customer_id,
            benefit_id=benefit_id,
            key=key,
            status=status,
            limit_activations=limit_activations,
            limit_usage=limit_usage,
            expires_at=expires_at,
        )
