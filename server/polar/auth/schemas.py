import typing
from collections.abc import Iterable

from pydantic import UUID4, EmailStr
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.factors import FactorBase

from polar.kit.http import ReturnTo
from polar.kit.schemas import Schema

type Factor = typing.Literal[
    "email_otp", "totp", "backup_codes", "apple", "github", "google"
]


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
            available_factors=[
                typing.cast(Factor, factor.identifier) for factor in factors
            ],
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


class BackupCodesEnrollment(Schema):
    codes: list[str]


class BackupCodesVerify(Schema):
    code: str


class BackupCodesStatus(Schema):
    codes: int
    used_codes: int
