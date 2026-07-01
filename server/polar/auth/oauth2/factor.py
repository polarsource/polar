import typing
import uuid

from reauth.factors.oauth2.base import OAuth2Account
from reauth.factors.oauth2.base import OAuth2Enrollment as OAuth2EnrollmentDataclass
from sqlalchemy import select, update

from polar.models import OAuthAccount
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession


class OAuth2FactorProtocol(typing.Protocol):
    identifier: str
    session: AsyncSession

    async def get_profile(self, access_token: str) -> dict[str, typing.Any]: ...


class OAuth2FactorMixin:
    IDENTIFIER: typing.ClassVar[str]
    SCOPE: typing.ClassVar[list[str]]
    session: AsyncSession

    async def get_enrollment(
        self, identity_id: uuid.UUID
    ) -> OAuth2EnrollmentDataclass | None:
        statement = select(OAuthAccount).where(
            OAuthAccount.platform == self.IDENTIFIER,
            OAuthAccount.user_id == identity_id,
        )
        result = await self.session.execute(statement)
        enrollment_orm = result.scalar_one_or_none()
        if enrollment_orm is None:
            return None
        return enrollment_orm.to_dataclass(self.SCOPE)

    async def insert(
        self: OAuth2FactorProtocol, enrollment: OAuth2EnrollmentDataclass
    ) -> uuid.UUID:
        profile = await self.get_profile(enrollment.access_token)
        email = await typing.cast(OAuth2FactorMixin, self).get_email(enrollment)
        enrollment_orm = OAuthAccount(
            platform=OAuthPlatform(self.identifier),
            expires_at=enrollment.expires_at,
            refresh_token_expires_at=enrollment.refresh_token_expires_at,
            account_id=enrollment.account_id,
            account_email=email,
            account_username=profile.get("name"),
            user_id=enrollment.identity_id,
        )
        await enrollment_orm.set_tokens(
            access_token=enrollment.access_token,
            refresh_token=enrollment.refresh_token,
        )
        self.session.add(enrollment_orm)
        await self.session.flush()
        return enrollment_orm.id

    async def update(
        self: OAuth2FactorProtocol, enrollment: OAuth2EnrollmentDataclass
    ) -> None:
        assert enrollment.id is not None
        profile = await self.get_profile(enrollment.access_token)
        email = await typing.cast(OAuth2FactorMixin, self).get_email(enrollment)
        statement = (
            update(OAuthAccount)
            .where(
                OAuthAccount.id == enrollment.id,
            )
            .values(
                access_token=enrollment.access_token,
                access_token_encrypted=await OAuthAccount.encrypt_access_token(
                    enrollment.id, enrollment.access_token
                ),
                expires_at=enrollment.expires_at,
                refresh_token=enrollment.refresh_token,
                refresh_token_encrypted=await OAuthAccount.encrypt_refresh_token(
                    enrollment.id, enrollment.refresh_token
                ),
                refresh_token_expires_at=enrollment.refresh_token_expires_at,
                account_email=email,
                account_username=profile.get("name"),
            )
        )
        await self.session.execute(statement)
        await self.session.flush()

    async def get_enrollment_by_provider_and_account(
        self, provider: str, account_id: str
    ) -> OAuth2EnrollmentDataclass | None:
        statement = select(OAuthAccount).where(
            OAuthAccount.platform == provider,
            OAuthAccount.account_id == account_id,
        )
        result = await self.session.execute(statement)
        enrollment_orm = result.scalar_one_or_none()
        if enrollment_orm is None:
            return None
        return enrollment_orm.to_dataclass(self.SCOPE)

    async def get_email(
        self, callback_result: OAuth2EnrollmentDataclass | OAuth2Account
    ) -> str:
        raise NotImplementedError()
