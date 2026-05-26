import typing
from collections.abc import Iterable

from pydantic import UUID4
from reauth.authentication_session import (
    AuthenticationSession as AuthenticationSessionDataclass,
)
from reauth.factors import FactorBase

from polar.kit.http import ReturnTo
from polar.kit.schemas import Schema

type Factor = typing.Literal["email_otp", "totp", "apple", "github", "google"]


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
    email: str


class EmailOTPVerify(Schema):
    code: str


class TOTPEnrollment(Schema):
    secret: str
    algorithm: str
    digits: int
    period: int
    provisioning_uri: str


class TOTPEnable(Schema):
    code: str


class TOTPVerify(Schema):
    code: str
