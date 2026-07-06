import typing
from collections.abc import Iterable

from pydantic import UUID4, EmailStr, Field
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.factors import FactorBase

from polar.kit.http import ReturnTo
from polar.kit.schemas import Schema

from .sso.factor import SSOFactorMixin

# The login method recorded in the `polar_last_login_method` cookie.
LoginMethod = typing.Literal[
    "email_otp", "totp", "backup_codes", "apple", "github", "google", "sso"
]


class BaseFactor(Schema):
    type: typing.Literal[
        "email_otp", "totp", "backup_codes", "apple", "github", "google"
    ]


class SSOFactor(Schema):
    type: typing.Literal["sso"] = "sso"
    connection_id: UUID4
    organization_slug: str
    name: str | None = Field(
        description="Human-friendly label for the connection, shown on the login page."
    )


Factor = typing.Annotated[BaseFactor | SSOFactor, Field(discriminator="type")]


def _factor_to_schema(factor: FactorBase[typing.Any]) -> BaseFactor | SSOFactor:
    if isinstance(factor, SSOFactorMixin):
        return SSOFactor(
            connection_id=factor.connection_id,
            organization_slug=factor.organization_slug,
            name=factor.name,
        )
    return BaseFactor.model_validate({"type": factor.identifier})


class AuthenticationSessionStart(Schema):
    return_to: ReturnTo | None = None


class AuthenticationSession(Schema):
    identity_id: UUID4 | None
    available_factors: list[Factor]

    @classmethod
    def from_session_and_factors(
        cls,
        authentication_session: AuthenticationSessionDataclass,
        factors: Iterable[FactorBase[typing.Any]],
    ) -> typing.Self:
        return cls(
            identity_id=authentication_session.identity_id,
            available_factors=[_factor_to_schema(factor) for factor in factors],
        )


class EmailOTPRequest(Schema):
    email: EmailStr


class EmailOTPVerify(Schema):
    code: str


class TOTPEnrollment(Schema):
    secret: str
    algorithm: str
    digits: int
    period: int
    provisioning_uri: str


class TOTPStatus(Schema):
    enabled: bool


class TOTPEnable(Schema):
    code: str


class TOTPVerify(Schema):
    code: str


class TOTPDelete(Schema):
    code: str | None = None


class BackupCodesEnroll(Schema):
    code: str | None = None


class BackupCodesEnrollment(Schema):
    codes: list[str]


class BackupCodesVerify(Schema):
    code: str


class BackupCodesStatus(Schema):
    codes: int
    used_codes: int
