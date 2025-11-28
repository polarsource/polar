from typing import TypedDict

import jwt
import structlog
from httpx_oauth.clients.openid import OpenID
from httpx_oauth.oauth2 import OAuth2Token

from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import OAuthAccount, User
from polar.models.user import OAuthPlatform
from polar.postgres import AsyncSession
from polar.user.oauth_service import oauth_account_service
from polar.user.repository import UserRepository
from polar.user.schemas import UserSignupAttribution
from polar.worker import enqueue_job

log: Logger = structlog.get_logger()


def get_apple_oauth_client(secret: bool = False) -> OpenID:
    if secret:
        iat = int(utc_now().timestamp())
        client_secret = jwt.encode(
            {
                "iss": settings.APPLE_TEAM_ID,
                "aud": "https://appleid.apple.com",
                "sub": settings.APPLE_CLIENT_ID,
                "iat": iat,
                "exp": iat + 3600,
            },
            settings.APPLE_KEY_VALUE,
            algorithm="ES256",
            headers={
                "kid": settings.APPLE_KEY_ID,
            },
        )
    else:
        client_secret = ""
    return OpenID(
        settings.APPLE_CLIENT_ID,
        client_secret,
        "https://appleid.apple.com/.well-known/openid-configuration",
        base_scopes=["openid", "email"],
    )


jwks_client = jwt.PyJWKClient("https://appleid.apple.com/auth/keys")


class AppleUserProfile(TypedDict):
    id: str
    email: str
    email_verified: bool


class AppleServiceError(PolarError): ...


class CannotLinkUnverifiedEmailError(AppleServiceError):
    def __init__(self, email: str) -> None:
        message = (
            f"An account already exists on Polar under the email {email}. "
            "We cannot automatically link it to your Apple account since "
            "this email address is not verified on Apple. "
            "Either verify your email address on Apple and try again "
            "or sign in using your email."
        )
        super().__init__(message, 403)


class AccountLinkedToAnotherUserError(AppleServiceError):
    def __init__(self) -> None:
        message = (
            "This Apple account is already linked to another user on Polar. "
            "You may have already created another account "
            "with a different email address."
        )
        super().__init__(message, 403)


class AppleService:
    async def get_updated_or_create(
        self,
        session: AsyncSession,
        *,
        token: OAuth2Token,
        signup_attribution: UserSignupAttribution | None = None,
    ) -> tuple[User, bool]:
        profile = await self._decode_profile(token["id_token"])
        user_repository = UserRepository.from_session(session)
        user = await user_repository.get_by_oauth_account(
            OAuthPlatform.apple, profile["id"]
        )

        if user is not None:
            oauth_account = user.get_oauth_account(OAuthPlatform.apple)
            assert oauth_account is not None
            oauth_account.access_token = token["access_token"]
            oauth_account.expires_at = token["expires_at"]
            oauth_account.account_username = profile["email"]
            session.add(oauth_account)
            return (user, False)

        oauth_account = OAuthAccount(
            platform=OAuthPlatform.apple,
            account_id=profile["id"],
            account_email=profile["email"],
            account_username=profile["email"],
            access_token=token["access_token"],
            expires_at=token["expires_at"],
        )

        user = await user_repository.get_by_email(profile["email"])
        if user is not None:
            if profile["email_verified"]:
                user.oauth_accounts.append(oauth_account)
                session.add(user)
                return (user, False)
            else:
                raise CannotLinkUnverifiedEmailError(profile["email"])

        user = User(
            email=profile["email"],
            email_verified=profile["email_verified"],
            avatar_url=None,
            oauth_accounts=[oauth_account],
            signup_attribution=signup_attribution,
        )

        session.add(user)
        await session.flush()

        enqueue_job("user.on_after_signup", user_id=user.id)

        return (user, True)

    async def link_user(
        self,
        session: AsyncSession,
        *,
        user: User,
        token: OAuth2Token,
    ) -> User:
        profile = await self._decode_profile(token["id_token"])

        oauth_account = await oauth_account_service.get_by_platform_and_account_id(
            session, OAuthPlatform.apple, profile["id"]
        )
        if oauth_account is not None:
            if oauth_account.user_id != user.id:
                raise AccountLinkedToAnotherUserError()
        else:
            oauth_account = OAuthAccount(
                platform=OAuthPlatform.apple,
                account_id=profile["id"],
                account_email=profile["email"],
            )
            user.oauth_accounts.append(oauth_account)
            log.info(
                "oauth_account.connect",
                user_id=user.id,
                platform="apple",
                account_email=profile["email"],
            )

        oauth_account.access_token = token["access_token"]
        oauth_account.expires_at = token["expires_at"]
        oauth_account.account_username = profile["email"]
        session.add(user)

        await session.flush()

        return user

    async def _decode_profile(self, id_token: str) -> AppleUserProfile:
        id_token_data = jwt.decode(
            id_token,
            key=jwks_client.get_signing_key_from_jwt(id_token),
            algorithms=["RS256"],
            audience=settings.APPLE_CLIENT_ID,
            issuer="https://appleid.apple.com",
        )
        return {
            "id": id_token_data["sub"],
            "email": id_token_data["email"],
            "email_verified": id_token_data["email_verified"],
        }


apple = AppleService()
