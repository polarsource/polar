from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass
from typing import Any, Literal, TypedDict
from uuid import UUID

import structlog

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.exceptions import PolarError, ResourceNotFound
from polar.kit import jwt
from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.kit.pagination import PaginationParams
from polar.models import MerchantMigration
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession

from .adapters import SourceAdapter, StripeAdapter
from .canonical import CanonicalRecord, deserialize
from .precheck import classify_records, precheck_engine
from .repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from .schemas import (
    MerchantMigrationCreate,
    MerchantMigrationRecordItem,
    PrecheckEntity,
    PrecheckRecordStatus,
    PrecheckReport,
)
from .stripe_oauth import (
    StripeAppNotConfigured,
    StripeOAuthError,
    StripeOAuthToken,
    stripe_oauth,
)

log = structlog.get_logger()

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


class MerchantMigrationNotFound(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__("Merchant migration not found.", 404)


class SourceNotConnected(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__("The migration source is not connected yet.", 400)


class UnsupportedMigrationSource(MerchantMigrationError):
    def __init__(self, source_platform: MerchantMigrationSourcePlatform) -> None:
        super().__init__(
            f"Migrations from {source_platform.value} are not supported yet.", 400
        )


class MerchantMigrationNotEnabled(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "Merchant migration is not enabled for this organization.", 403
        )


class NotAStripeMigration(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__("This migration does not use Stripe as its source.", 400)


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

    async def list(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        organization_id: UUID,
        pagination: PaginationParams,
    ) -> tuple[Sequence[MerchantMigration], int]:
        repository = MerchantMigrationRepository.from_session(session)
        statement = (
            repository.get_readable_statement(auth_subject)
            .where(MerchantMigration.organization_id == organization_id)
            .order_by(MerchantMigration.created_at.desc())
        )
        return await repository.paginate(
            statement, limit=pagination.limit, page=pagination.page
        )

    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        create_schema: MerchantMigrationCreate,
    ) -> MerchantMigration:
        await assert_organization_permission(
            session,
            auth_subject,
            create_schema.organization_id,
            OrganizationPermission.organization_manage,
        )
        await self._assert_feature_enabled(session, create_schema.organization_id)
        repository = MerchantMigrationRepository.from_session(session)
        return await repository.create(
            MerchantMigration(
                organization_id=create_schema.organization_id,
                source_platform=create_schema.source_platform,
                step=MerchantMigrationStep.source_setup,
            ),
            flush=True,
        )

    async def run_precheck(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> PrecheckReport:
        """Read the connected source, normalize it, and report whether it can be
        imported. Advances the migration from source setup to the precheck step.
        """
        repository = MerchantMigrationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            MerchantMigration.id == migration_id
        )
        migration = await repository.get_one_or_none(statement)
        if migration is None:
            raise MerchantMigrationNotFound()
        await assert_organization_permission(
            session,
            auth_subject,
            migration.organization_id,
            OrganizationPermission.organization_manage,
        )

        organization = await OrganizationRepository.from_session(session).get_by_id(
            migration.organization_id
        )
        if organization is None:
            raise MerchantMigrationNotFound()

        adapter = await self._build_adapter(session, migration)
        source_account = await adapter.get_source_account()
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        report = await precheck_engine.run(
            self._stage_records(
                record_repository, migration, organization, adapter.extract()
            ),
            organization,
            source_account,
        )

        await repository.update(
            migration, update_dict={"step": MerchantMigrationStep.pre_check}
        )
        return report

    async def list_records(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        entity: PrecheckEntity,
        status: PrecheckRecordStatus | None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[MerchantMigrationRecordItem], int]:
        """Return the records of one entity type from the staged ledger,
        classified importable/skipped and paginated in memory. Reads what
        ``run_precheck`` persisted, so it never re-reads the source."""
        repository = MerchantMigrationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            MerchantMigration.id == migration_id
        )
        migration = await repository.get_one_or_none(statement)
        if migration is None:
            raise MerchantMigrationNotFound()
        await assert_organization_permission(
            session,
            auth_subject,
            migration.organization_id,
            OrganizationPermission.organization_manage,
        )

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        staged = await record_repository.list_by_migration(migration.id)
        records = [deserialize(record.type, record.canonical) for record in staged]
        items = classify_records(records, entity)
        if status is not None:
            items = [item for item in items if item.status == status]

        start = (pagination.page - 1) * pagination.limit
        return items[start : start + pagination.limit], len(items)

    async def _stage_records(
        self,
        record_repository: MerchantMigrationRecordRepository,
        migration: MerchantMigration,
        organization: Organization,
        records: AsyncIterator[CanonicalRecord],
    ) -> AsyncIterator[CanonicalRecord]:
        """Stage each record as it streams past, so we persist the catalog in
        the same single pass the precheck reads (extraction stays incremental)."""
        async for record in records:
            await record_repository.upsert(migration, organization, record)
            yield record

    async def _build_adapter(
        self, session: AsyncSession, migration: MerchantMigration
    ) -> SourceAdapter:
        if migration.source_platform != MerchantMigrationSourcePlatform.stripe:
            raise UnsupportedMigrationSource(migration.source_platform)
        access_token = await self._refresh_stripe_access_token(session, migration)
        return StripeAdapter(access_token)

    async def _refresh_stripe_access_token(
        self, session: AsyncSession, migration: MerchantMigration
    ) -> str:
        """Mint a short-lived access token from the stored refresh token, and
        persist the rotated refresh token Stripe returns."""
        credentials = migration.source_credentials
        encrypted = credentials.get("refresh_token_encrypted")
        if not encrypted:
            raise SourceNotConnected()

        refresh_token = await EncryptedString(
            encrypted, SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT
        ).decrypt(id=str(migration.id))
        token = await stripe_oauth.refresh(refresh_token)

        new_credentials = await self._build_stripe_credentials(migration, token)
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration, update_dict={"source_credentials": dict(new_credentials)}
        )
        return token.access_token

    async def _assert_feature_enabled(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None or not organization.is_merchant_migration_enabled:
            raise MerchantMigrationNotEnabled()

    async def create_stripe_authorization_url(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        *,
        migration_id: UUID,
        redirect_uri: str,
        return_to: str,
    ) -> str:
        migration = await self.get(session, auth_subject, migration_id)
        if migration is None:
            raise ResourceNotFound()
        await assert_organization_permission(
            session,
            auth_subject,
            migration.organization_id,
            OrganizationPermission.organization_manage,
        )
        if migration.source_platform != MerchantMigrationSourcePlatform.stripe:
            raise NotAStripeMigration()
        if not stripe_oauth.is_configured():
            raise StripeAppNotConfigured()

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
        except (StripeOAuthError, MerchantMigrationError) as e:
            log.error(
                "merchant_migration.stripe_authorization_failed",
                migration_id=state_data.get("migration_id"),
                error=str(e),
            )
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

    async def _build_stripe_credentials(
        self, migration: MerchantMigration, token: StripeOAuthToken
    ) -> StripeSourceCredentials:
        encrypted = await EncryptedString.encrypt(
            token.refresh_token,
            context={**SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT, "id": str(migration.id)},
        )
        return StripeSourceCredentials(
            stripe_user_id=token.stripe_user_id,
            scope=token.scope,
            livemode=token.livemode,
            refresh_token_encrypted=encrypted.encrypted_value,
        )


merchant_migration = MerchantMigrationService()
