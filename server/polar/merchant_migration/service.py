from dataclasses import dataclass
from typing import Any, Literal, TypedDict
from uuid import UUID

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.exceptions import PolarError
from polar.kit import jwt
from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.models import MerchantMigration
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.postgres import AsyncReadSession

from .repository import MerchantMigrationRepository
from .stripe_oauth import (
    StripeAppNotConfigured,
    StripeOAuthError,
    StripeOAuthToken,
    stripe_oauth,
)

OAUTH_STATE_JWT_TYPE: Literal["stripe_app_oauth"] = "stripe_app_oauth"
# The state must survive the whole interactive consent on Stripe, so give it more
# room than the 15-minute JWT default.
OAUTH_STATE_EXPIRATION = 60 * 60

SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT = {
    "table": "merchant_migrations",
    "column": "source_credentials",
}


class StripeSourceCredentials(TypedDict):
    """Shape of ``MerchantMigration.source_credentials`` for a Stripe source.

    Only ``refresh_token_encrypted`` is a secret: it holds the ciphertext of the
    long-lived refresh token, decrypted on demand to mint a short-lived access
    token. The other fields are non-secret account metadata.
    """

    stripe_user_id: str
    scope: str
    livemode: bool
    refresh_token_encrypted: str


class MerchantMigrationError(PolarError): ...


class InvalidStripeOAuthState(MerchantMigrationError):
    def __init__(self, message: str = "Invalid Stripe authorization state.") -> None:
        super().__init__(message, 400)


@dataclass
class StripeConnectResult:
    """Where the callback should send the merchant back, and an error message to
    surface there if the connection didn't complete."""

    return_to: str
    error: str | None = None


class MerchantMigrationService:
    async def get(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> MerchantMigration | None:
        repository = MerchantMigrationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            MerchantMigration.id == migration_id
        )
        return await repository.get_one_or_none(statement)

    async def create_stripe_authorization_url(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID,
        redirect_uri: str,
        return_to: str,
    ) -> str:
        await assert_organization_permission(
            session,
            auth_subject,
            organization_id,
            OrganizationPermission.organization_manage,
        )
        if not stripe_oauth.is_configured():
            raise StripeAppNotConfigured()

        migration = await self._get_or_create_stripe_migration(session, organization_id)

        state = jwt.encode(
            data={
                "migration_id": str(migration.id),
                "subject_id": str(auth_subject.subject.id),
                "return_to": return_to,
            },
            secret=settings.SECRET,
            type=OAUTH_STATE_JWT_TYPE,
            expires_in=OAUTH_STATE_EXPIRATION,
        )
        return stripe_oauth.build_authorize_url(state=state, redirect_uri=redirect_uri)

    async def complete_stripe_authorization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        state: str,
        code: str | None,
        error: str | None,
    ) -> StripeConnectResult:
        """Handle the Stripe OAuth callback end to end: validate the state, run
        the code exchange, and store the credentials. A tampered/expired state
        raises (nothing trustworthy to redirect to); every other failure comes
        back as a ``StripeConnectResult`` with an ``error`` to show the merchant.
        """
        state_data = self._decode_state(state)
        return_to = state_data.get("return_to") or ""

        if state_data.get("subject_id") != str(auth_subject.subject.id):
            return StripeConnectResult(
                return_to=return_to,
                error="Authorization must be completed by the same account "
                "that started it.",
            )
        if code is None or error is not None:
            return StripeConnectResult(
                return_to=return_to,
                error=error or "Failed to connect Stripe account.",
            )

        try:
            await self._store_stripe_credentials(
                session, auth_subject, UUID(state_data["migration_id"]), code
            )
        except (StripeOAuthError, MerchantMigrationError):
            return StripeConnectResult(
                return_to=return_to, error="Failed to connect Stripe account."
            )
        return StripeConnectResult(return_to=return_to)

    def _decode_state(self, state: str) -> dict[str, Any]:
        try:
            return jwt.decode(
                token=state, secret=settings.SECRET, type=OAUTH_STATE_JWT_TYPE
            )
        except (jwt.DecodeError, jwt.ExpiredSignatureError) as e:
            raise InvalidStripeOAuthState(str(e)) from e

    async def _store_stripe_credentials(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        code: str,
    ) -> None:
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_by_id(migration_id)
        if migration is None:
            raise InvalidStripeOAuthState("Unknown migration.")
        await assert_organization_permission(
            session,
            auth_subject,
            migration.organization_id,
            OrganizationPermission.organization_manage,
        )

        token = await stripe_oauth.exchange_code(code)
        credentials = await self._build_stripe_credentials(migration, token)
        await repository.update(
            migration, update_dict={"source_credentials": dict(credentials)}
        )

    async def decrypt_stripe_refresh_token(self, migration: MerchantMigration) -> str:
        credentials = migration.source_credentials
        encrypted = credentials.get("refresh_token_encrypted")
        if not encrypted:
            raise MerchantMigrationError(
                "No Stripe credentials stored for this migration.", 409
            )
        return await EncryptedString(
            encrypted, self._encryption_context(migration.id)
        ).decrypt()

    async def _get_or_create_stripe_migration(
        self, session: AsyncSession, organization_id: UUID
    ) -> MerchantMigration:
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_ongoing_by_source(
            organization_id, MerchantMigrationSourcePlatform.stripe
        )
        if migration is not None:
            return migration
        return await repository.create(
            MerchantMigration(
                organization_id=organization_id,
                source_platform=MerchantMigrationSourcePlatform.stripe,
                step=MerchantMigrationStep.source_setup,
            ),
            flush=True,
        )

    async def _build_stripe_credentials(
        self, migration: MerchantMigration, token: StripeOAuthToken
    ) -> StripeSourceCredentials:
        encrypted = await EncryptedString.encrypt(
            token.refresh_token, context=self._encryption_context(migration.id)
        )
        return StripeSourceCredentials(
            stripe_user_id=token.stripe_user_id,
            scope=token.scope,
            livemode=token.livemode,
            refresh_token_encrypted=encrypted.encrypted_value,
        )

    def _encryption_context(self, migration_id: UUID) -> dict[str, str]:
        return {**SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT, "id": str(migration_id)}


merchant_migration = MerchantMigrationService()
