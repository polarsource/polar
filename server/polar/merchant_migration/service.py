from collections.abc import AsyncIterator, Sequence
from dataclasses import dataclass, field
from typing import Any, TypedDict
from uuid import UUID

import stripe as stripe_lib

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.exceptions import PolarError
from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.kit.pagination import PaginationParams
from polar.models import MerchantMigration, MerchantMigrationRecord
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordType,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository

from .adapters import SourceAdapter, StripeAdapter
from .canonical import CanonicalAccount, CanonicalRecord, deserialize
from .importer import CatalogImporter
from .precheck import classify_records, import_blockers, precheck_engine
from .repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from .schemas import (
    MerchantMigrationCounts,
    MerchantMigrationCreate,
    MerchantMigrationImportReport,
    MerchantMigrationRecordItem,
    PrecheckEntity,
    PrecheckEntitySummary,
    PrecheckIssue,
    PrecheckReasonLevel,
    PrecheckRecordStatus,
    PrecheckReport,
)

IMPORTABLE_STEPS = {
    MerchantMigrationStep.pre_check,
    MerchantMigrationStep.create_catalog,
}

# Entities whose records map 1:1 to a ledger row, so a listing item can carry its
# record id for selection. Prices live inside a product record and are excluded.
_ENTITY_RECORD_TYPE = {
    PrecheckEntity.products: MerchantMigrationRecordType.product,
    PrecheckEntity.customers: MerchantMigrationRecordType.customer,
    PrecheckEntity.subscriptions: MerchantMigrationRecordType.subscription,
}

SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT = {
    "table": "merchant_migrations",
    "column": "source_credentials",
}


class StripeSourceCredentials(TypedDict):
    """Shape of ``MerchantMigration.source_credentials`` for a Stripe source.

    Only ``api_key_encrypted`` is a secret: the ciphertext of the merchant's
    restricted API key, decrypted on demand to read their account. The other
    fields are non-secret metadata surfaced to the API.
    """

    api_key_encrypted: str
    stripe_user_id: str | None
    livemode: bool
    # The two account facts the blockers depend on, so a read can answer "can
    # this import run?" without calling Stripe. Refreshed on every pre-check.
    country: str | None
    is_connect_platform: bool


@dataclass
class _StagedKeys:
    """What a staging pass saw. ``complete`` says the source stream was read to
    the end, which is what makes it safe to prune everything it didn't mention."""

    keys: set[tuple[MerchantMigrationRecordType, str]] = field(default_factory=set)
    complete: bool = False


class MerchantMigrationError(PolarError): ...


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


class InvalidSourceCredentials(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "The provided Stripe API key is invalid.",
            400,
        )


class MissingStripeScopes(MerchantMigrationError):
    def __init__(self, missing: list[str]) -> None:
        self.missing = missing
        super().__init__(
            "The Stripe API key is missing access to: " + ", ".join(missing) + ".",
            400,
        )


class SourceVerificationUnavailable(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "We couldn't verify the Stripe key right now. Please try again.",
            502,
        )


class CatalogImportNotReady(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "Run the pre-check before importing the catalog.",
            409,
        )


class CatalogImportBlocked(MerchantMigrationError):
    def __init__(self, blockers: list[PrecheckIssue]) -> None:
        self.blockers = [issue.code for issue in blockers]
        super().__init__(
            "The migration can't be imported: " + " ".join(i.message for i in blockers),
            409,
        )


class SourceKeyModeMismatch(MerchantMigrationError):
    def __init__(self, *, expect_live: bool) -> None:
        mode = "live" if expect_live else "test"
        super().__init__(
            f"This Polar environment needs a {mode}-mode Stripe key "
            f"(e.g. `rk_{mode}_…`), so the migration runs against {mode} data.",
            400,
        )


def _is_live_key(api_key: str) -> bool:
    # `*_live_` keys operate on live Stripe data; everything else is test mode.
    return api_key.startswith(("rk_live_", "sk_live_"))


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
        """Validate the source API key's permissions, then create the migration
        with the key stored. If the key is invalid or missing any required scope,
        nothing is persisted — the merchant fixes the key and retries."""
        await assert_organization_permission(
            session,
            auth_subject,
            create_schema.organization_id,
            OrganizationPermission.organization_manage,
        )
        await self._assert_feature_enabled(session, create_schema.organization_id)
        if create_schema.source_platform != MerchantMigrationSourcePlatform.stripe:
            raise UnsupportedMigrationSource(create_schema.source_platform)

        # The key's mode must match the Polar environment, so a live cutover never
        # runs against Stripe test data (and a sandbox run never touches live data).
        expect_live = settings.is_production()
        if _is_live_key(create_schema.api_key) != expect_live:
            raise SourceKeyModeMismatch(expect_live=expect_live)

        adapter = StripeAdapter(create_schema.api_key)
        try:
            missing_scopes = await adapter.verify_scopes()
        except stripe_lib.AuthenticationError as e:
            raise InvalidSourceCredentials() from e
        except stripe_lib.StripeError as e:
            # A non-permission failure (rate limit, network) means we couldn't
            # fully check the key — fail closed rather than store an unvalidated one.
            raise SourceVerificationUnavailable() from e
        if missing_scopes:
            raise MissingStripeScopes(missing_scopes)

        # Pre-generate the id so the credentials (encrypted with it as context) can
        # be set before the row is inserted — one INSERT instead of INSERT+UPDATE.
        migration = MerchantMigration(
            id=MerchantMigration.generate_id(),
            organization_id=create_schema.organization_id,
            source_platform=create_schema.source_platform,
            step=MerchantMigrationStep.source_setup,
        )
        migration.source_credentials = dict(
            await self._build_stripe_credentials(
                migration, create_schema.api_key, adapter
            )
        )
        repository = MerchantMigrationRepository.from_session(session)
        return await repository.create(migration, flush=True)

    async def run_precheck(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> PrecheckReport:
        """Read the connected source, normalize it, and report whether it can be
        imported. Advances the migration from source setup to the pre-check step,
        unless the report says something blocks the import."""
        migration = await self._lock_manageable(session, auth_subject, migration_id)

        organization = await OrganizationRepository.from_session(session).get_by_id(
            migration.organization_id
        )
        if organization is None:
            raise MerchantMigrationNotFound()

        adapter = await self._build_adapter(migration)
        source_account = await adapter.get_source_account()
        existing_product_names = await ProductRepository.from_session(
            session
        ).get_active_names_by_organization(organization.id)
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        staged = _StagedKeys()
        report = await precheck_engine.run(
            self._stage_records(
                record_repository, migration, organization, adapter.extract(), staged
            ),
            organization,
            source_account,
            existing_product_names,
        )
        # Pruning against a half-read source would delete records it still has.
        if staged.complete:
            await record_repository.prune_missing(migration, staged.keys)

        repository = MerchantMigrationRepository.from_session(session)
        update_dict: dict[str, Any] = {
            "source_credentials": {
                **migration.source_credentials,
                "country": source_account.country,
                "is_connect_platform": source_account.is_connect_platform,
            }
        }
        # A blocked migration stays on source setup, so the merchant keeps the
        # panel that tells them what to fix instead of landing on a review table
        # they can't import from. Re-running to refresh the ledger must also not
        # regress a migration that has already moved on.
        if migration.step == MerchantMigrationStep.source_setup and report.can_start:
            update_dict["step"] = MerchantMigrationStep.pre_check
        await repository.update(migration, update_dict=update_dict)
        return report

    async def import_catalog(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        record_ids: Sequence[UUID] | None = None,
        exclude_record_ids: Sequence[UUID] | None = None,
    ) -> MerchantMigrationImportReport:
        """Create the Polar catalog from the staged importable records, then
        advance the migration to the create-catalog step. Idempotent: re-running
        only imports records still pending in the ledger."""
        migration = await self._lock_manageable(session, auth_subject, migration_id)
        if migration.step not in IMPORTABLE_STEPS:
            raise CatalogImportNotReady()

        organization = await OrganizationRepository.from_session(session).get_by_id(
            migration.organization_id
        )
        if organization is None:
            raise MerchantMigrationNotFound()

        # The pre-check reports blockers but doesn't stop the import, and both the
        # org and the source account can change after it ran.
        adapter = await self._build_adapter(migration)
        blockers = import_blockers(organization, await adapter.get_source_account())
        if blockers:
            raise CatalogImportBlocked(blockers)

        report = await CatalogImporter(
            session,
            migration,
            organization,
            auth_subject,
            record_ids=set(record_ids) if record_ids is not None else None,
            exclude_record_ids=(
                set(exclude_record_ids) if exclude_record_ids is not None else None
            ),
        ).run()

        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration, update_dict={"step": MerchantMigrationStep.create_catalog}
        )
        report.step = MerchantMigrationStep.create_catalog
        return report

    async def _lock_manageable(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> MerchantMigration:
        """Serialized so a double-click or retry can't run twice. Takes the write
        session on purpose: a replica can't lock a row."""
        return await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )

    async def _get_manageable(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        for_update: bool = False,
    ) -> MerchantMigration:
        repository = MerchantMigrationRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).where(
            MerchantMigration.id == migration_id
        )
        if for_update:
            # Serialized so a double-click or retry can't create duplicates.
            statement = statement.with_for_update(of=MerchantMigration)
        migration = await repository.get_one_or_none(statement)
        if migration is None:
            raise MerchantMigrationNotFound()
        await assert_organization_permission(
            session,
            auth_subject,
            migration.organization_id,
            OrganizationPermission.organization_manage,
        )
        return migration

    async def list_records(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        entity: PrecheckEntity | None,
        status: PrecheckRecordStatus | None,
        reason_level: PrecheckReasonLevel | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[MerchantMigrationRecordItem], int]:
        """Return staged records classified importable/skipped and paginated in
        memory. ``entity`` scopes to one type; ``None`` returns products, customers
        and subscriptions together. ``status`` filters to importable or skipped;
        ``reason_level`` filters to rows the merchant has to act on
        (`action_required`) or only needs to know about (`info`). Reads what
        ``run_precheck`` persisted."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        items = await self._classify_staged(session, migration, entity=entity)

        if status is not None:
            items = [item for item in items if item.status == status]
        if reason_level is not None:
            items = [item for item in items if item.reason_level == reason_level]

        start = (pagination.page - 1) * pagination.limit
        return items[start : start + pagination.limit], len(items)

    async def count_records(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> MerchantMigrationCounts:
        """Everything the review page needs to draw its tabs and totals. It
        classifies the ledger once, where per-entity listings made the page ask
        for the same work seven times."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        organization = await OrganizationRepository.from_session(session).get_by_id(
            migration.organization_id
        )
        if organization is None:
            raise MerchantMigrationNotFound()

        items = await self._classify_staged(session, migration)
        by_entity = {
            entity: [item for item in items if item.entity == entity]
            for entity in _ENTITY_RECORD_TYPE
        }
        return MerchantMigrationCounts(
            entities=[
                PrecheckEntitySummary(
                    entity=entity,
                    total=len(entity_items),
                    importable=sum(
                        1
                        for item in entity_items
                        if item.status == PrecheckRecordStatus.importable
                    ),
                    skipped=sum(
                        1
                        for item in entity_items
                        if item.status == PrecheckRecordStatus.skipped
                    ),
                )
                for entity, entity_items in by_entity.items()
            ],
            action_required=sum(
                1
                for item in items
                if item.reason_level == PrecheckReasonLevel.action_required
            ),
            blockers=import_blockers(
                organization, self._stored_source_account(migration)
            ),
        )

    async def _classify_staged(
        self,
        session: AsyncReadSession,
        migration: MerchantMigration,
        *,
        entity: PrecheckEntity | None = None,
    ) -> Sequence[MerchantMigrationRecordItem]:
        """Classify what ``run_precheck`` staged. ``None`` covers every entity
        that has its own ledger row."""
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        staged = await record_repository.list_by_migration(migration.id)
        records = [deserialize(record.type, record.canonical) for record in staged]
        existing_product_names = await ProductRepository.from_session(
            session
        ).get_active_names_by_organization(migration.organization_id)

        items: list[MerchantMigrationRecordItem] = []
        for entity_type in (
            [entity] if entity is not None else list(_ENTITY_RECORD_TYPE)
        ):
            entity_items = classify_records(
                records, entity_type, existing_product_names
            )
            self._attach_record_ids(entity_items, staged, entity_type)
            items.extend(entity_items)
        return items

    def _attach_record_ids(
        self,
        items: Sequence[MerchantMigrationRecordItem],
        staged: Sequence[MerchantMigrationRecord],
        entity: PrecheckEntity,
    ) -> None:
        """Give each item its ledger record id, so a row can be selected for
        import. The 1:1 entities (products/customers/subscriptions) map to their
        staged records in order — both derive from the same `staged` fetch. Prices
        aren't their own record (they live in a product), so they keep a null id.
        """
        record_type = _ENTITY_RECORD_TYPE.get(entity)
        if record_type is None:
            return
        staged_of_type = [record for record in staged if record.type == record_type]
        if len(staged_of_type) != len(items):
            return
        for item, record in zip(items, staged_of_type, strict=True):
            item.record_id = record.id
            item.import_status = record.status

    async def _stage_records(
        self,
        record_repository: MerchantMigrationRecordRepository,
        migration: MerchantMigration,
        organization: Organization,
        records: AsyncIterator[CanonicalRecord],
        staged: "_StagedKeys",
    ) -> AsyncIterator[CanonicalRecord]:
        """Stage each record as it streams past, so we persist the catalog in
        the same single pass the precheck reads (extraction stays incremental).
        Collects the keys it saw, so the caller can drop what the source no
        longer has."""
        async for record in records:
            await record_repository.upsert(migration, organization, record)
            staged.keys.add((record.type, record.source_id))
            yield record
        staged.complete = True

    async def _build_adapter(self, migration: MerchantMigration) -> SourceAdapter:
        if migration.source_platform != MerchantMigrationSourcePlatform.stripe:
            raise UnsupportedMigrationSource(migration.source_platform)
        return StripeAdapter(await self._decrypt_stripe_api_key(migration))

    async def _decrypt_stripe_api_key(self, migration: MerchantMigration) -> str:
        encrypted = migration.source_credentials.get("api_key_encrypted")
        if not encrypted:
            raise SourceNotConnected()
        return await EncryptedString(
            encrypted, SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT
        ).decrypt(id=str(migration.id))

    async def _build_stripe_credentials(
        self,
        migration: MerchantMigration,
        api_key: str,
        adapter: StripeAdapter,
    ) -> StripeSourceCredentials:
        encrypted = await EncryptedString.encrypt(
            api_key,
            context={**SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT, "id": str(migration.id)},
        )
        account = await adapter.get_source_account()
        return StripeSourceCredentials(
            api_key_encrypted=encrypted.encrypted_value,
            stripe_user_id=await adapter.get_account_id(),
            livemode=_is_live_key(api_key),
            country=account.country,
            is_connect_platform=account.is_connect_platform,
        )

    def _stored_source_account(self, migration: MerchantMigration) -> CanonicalAccount:
        """The source account as last seen, so a read can report blockers without
        a Stripe round-trip. `run_precheck` refreshes it."""
        credentials = migration.source_credentials
        return CanonicalAccount(
            country=credentials.get("country"),
            is_connect_platform=bool(credentials.get("is_connect_platform")),
        )

    async def _assert_feature_enabled(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None or not organization.is_merchant_migration_enabled:
            raise MerchantMigrationNotEnabled()


merchant_migration = MerchantMigrationService()
