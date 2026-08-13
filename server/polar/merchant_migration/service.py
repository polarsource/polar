from collections.abc import AsyncIterator, Sequence
from datetime import datetime
from typing import Any, TypedDict
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.kit.pagination import PaginationParams
from polar.logging import Logger
from polar.models import MerchantMigration, MerchantMigrationRecord, Subscription
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.organization.repository import OrganizationRepository
from polar.postgres import AsyncReadSession
from polar.product.repository import ProductRepository
from polar.subscription.repository import SubscriptionRepository
from polar.worker import enqueue_job

from . import pan_transfer
from .adapters import SourceAdapter, StripeAdapter
from .canonical import CanonicalRecord, deserialize
from .cards import link_payment_method
from .errors import MerchantMigrationError
from .importer import CatalogImporter
from .pan_transfer import (
    STEP_VERIFY_CARDS,
    PanStepActor,
    PanStepOwner,
    PanStepStatus,
    PanTransferAlreadyStarted,
    PanTransferNotReady,
    PanTransferNotStarted,
    PanTransferStep,
    PanTransferUnavailable,
)
from .precheck import (
    account_blockers,
    classify_records,
    import_blockers,
    precheck_engine,
)
from .repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from .schemas import (
    MerchantMigrationCreate,
    MerchantMigrationImportReport,
    MerchantMigrationRecordItem,
    MerchantMigrationRecordSummary,
    MerchantMigrationRecordSummaryEntity,
    PanTransferCardCoverage,
    PanTransferChecklist,
    PrecheckEntity,
    PrecheckIssue,
    PrecheckReasonLevel,
    PrecheckRecordStatus,
    PrecheckReport,
)

log: Logger = structlog.get_logger()

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

# Checklist steps Polar performs itself, and the job that performs them. A step
# here is never completed by a person: becoming current is what schedules the
# work, and the work is what completes it.
_STEP_TASKS = {STEP_VERIFY_CARDS: "merchant_migration.verify_cards"}


# One Stripe round trip per customer, so a whole catalog can't be one job.
CARD_VERIFICATION_BATCH_SIZE = 25


class StripeSourceCredentials(TypedDict):
    """Shape of ``MerchantMigration.source_credentials`` for a Stripe source.

    Only ``api_key_encrypted`` is a secret: the ciphertext of the merchant's
    restricted API key, decrypted on demand to read their account. The other
    fields are non-secret metadata surfaced to the API.
    """

    api_key_encrypted: str
    stripe_user_id: str | None
    livemode: bool


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


class BlockedByPrecheck(MerchantMigrationError):
    """Precheck blockers as an API error: the codes stay machine-readable while
    the merchant reads the joined messages."""

    def __init__(
        self, summary: str, blockers: list[PrecheckIssue], status_code: int
    ) -> None:
        self.blockers = [issue.code for issue in blockers]
        super().__init__(
            f"{summary} " + " ".join(issue.message for issue in blockers), status_code
        )


class CatalogImportBlocked(BlockedByPrecheck):
    def __init__(self, blockers: list[PrecheckIssue]) -> None:
        super().__init__("The migration can't be imported:", blockers, 409)


class SourceAccountNotMigratable(BlockedByPrecheck):
    def __init__(self, blockers: list[PrecheckIssue]) -> None:
        super().__init__("This account can't be migrated:", blockers, 400)


class SourceKeyModeMismatch(MerchantMigrationError):
    def __init__(self, *, expect_live: bool) -> None:
        mode = "live" if expect_live else "test"
        super().__init__(
            f"This Polar environment needs a {mode}-mode Stripe key "
            f"(e.g. `rk_{mode}_…`), so the migration runs against {mode} data.",
            400,
        )


def _summarize_entities(
    items: Sequence[MerchantMigrationRecordItem], entities: Sequence[PrecheckEntity]
) -> list[MerchantMigrationRecordSummaryEntity]:
    """Tally every entity in one pass over the classified rows."""
    tallies = {
        entity: {"total": 0, "importable": 0, "imported": 0, "selectable": 0}
        for entity in entities
    }
    for item in items:
        tally = tallies.get(item.entity)
        if tally is None:
            continue
        tally["total"] += 1
        if item.import_status == MerchantMigrationRecordStatus.imported:
            tally["imported"] += 1
        if item.status != PrecheckRecordStatus.importable:
            continue
        tally["importable"] += 1
        # Only pending rows move; the importer skips every other ledger status.
        if item.import_status == MerchantMigrationRecordStatus.pending:
            tally["selectable"] += 1

    return [
        MerchantMigrationRecordSummaryEntity(
            entity=entity,
            total=tally["total"],
            importable=tally["importable"],
            skipped=tally["total"] - tally["importable"],
            imported=tally["imported"],
            selectable=tally["selectable"],
        )
        for entity, tally in tallies.items()
    ]


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

        # The key's mode must match the Polar environment, so a live switch never
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

        # An account we can never migrate is rejected here rather than at the
        # import, so the merchant hears it while they're still connecting the key.
        blockers = account_blockers(await adapter.get_source_account())
        if blockers:
            raise SourceAccountNotMigratable(blockers)

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
        imported. Advances the migration from source setup to the precheck step.
        """
        migration = await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )

        organization = await self._get_organization(session, migration)

        adapter = await self._build_adapter(migration)
        source_account = await adapter.get_source_account()
        existing_product_names = await ProductRepository.from_session(
            session
        ).get_active_names_by_organization(organization.id)
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        report = await precheck_engine.run(
            self._stage_records(
                record_repository, migration, organization, adapter.extract()
            ),
            organization,
            source_account,
            existing_product_names,
        )

        # Re-running the precheck to refresh the ledger must not regress a
        # migration that has already moved on.
        if migration.step == MerchantMigrationStep.source_setup:
            repository = MerchantMigrationRepository.from_session(session)
            await repository.update(
                migration, update_dict={"step": MerchantMigrationStep.pre_check}
            )
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
        migration = await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )
        if migration.step not in IMPORTABLE_STEPS:
            raise CatalogImportNotReady()

        organization = await self._get_organization(session, migration)

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

    async def get_pan_transfer(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> PanTransferChecklist:
        """The card-move checklist. Returns an empty one before it's started, so
        the client can show the method and the destination account up front."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        return await self._checklist(session, migration)

    async def start_pan_transfer(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> PanTransferChecklist:
        """Move the migration onto the card step and lay out its checklist. The
        catalog has to exist first: the checklist verifies cards against imported
        subscriptions, and there's nothing to verify against without them."""
        migration = await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )
        if migration.pan_transfer_steps:
            raise PanTransferAlreadyStarted()
        if migration.step != MerchantMigrationStep.create_catalog:
            raise PanTransferNotReady()
        # The first step tells the merchant which Stripe account to send the cards
        # to. Without it configured we'd mark that step done while showing them
        # nothing, and they'd address the transfer to no one.
        if not settings.MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID:
            raise PanTransferUnavailable()

        steps = pan_transfer.build(migration.pan_transfer_method)
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration,
            update_dict={
                "step": MerchantMigrationStep.copy_cards,
                "pan_transfer_steps": steps,
            },
        )
        return await self._checklist(session, migration, steps)

    async def complete_pan_step(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        key: str,
        *,
        inputs: dict[str, str],
    ) -> PanTransferChecklist:
        """Complete a merchant-owned step. Steps owned by Polar Ops, Stripe or the
        source provider are moved from the backoffice, not here."""
        migration = await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )
        return await self._complete_pan_step(
            session, migration, key, actor=PanStepActor.merchant, inputs=inputs
        )

    async def complete_pan_step_as_ops(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        key: str,
        *,
        inputs: dict[str, str],
    ) -> PanTransferChecklist:
        """Complete a step from the backoffice. Ops move their own steps, and the
        ones we only observe (Stripe, the source provider); they can also complete
        a merchant step to unblock someone who is stuck. Admin-gated by the caller,
        so there is no auth subject to scope on."""
        return await self._complete_pan_step(
            session, migration, key, actor=PanStepActor.ops, inputs=inputs
        )

    async def _complete_pan_step(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        key: str,
        *,
        actor: PanStepActor,
        inputs: dict[str, str],
    ) -> PanTransferChecklist:
        """Complete a step and advance. Go through here, not `pan_transfer`
        directly: this is what schedules the job for the step that follows."""
        if not migration.pan_transfer_steps:
            raise PanTransferNotStarted()

        steps = pan_transfer.complete(
            migration.pan_transfer_method,
            list(migration.pan_transfer_steps),
            key,
            actor=actor,
            inputs=inputs,
        )
        await self._advance_checklist(session, migration, steps)
        return await self._checklist(session, migration, steps)

    async def _advance_checklist(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        steps: Sequence[PanTransferStep],
        **extra: Any,
    ) -> None:
        """Persist the checklist and schedule the job for a step Polar
        performs itself."""
        current = pan_transfer.current(steps)
        update_dict: dict[str, Any] = {"pan_transfer_steps": list(steps), **extra}
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(migration, update_dict=update_dict)

        if current is None or current.owner != PanStepOwner.polar_app:
            return
        task = _STEP_TASKS.get(current.key)
        if task is not None:
            enqueue_job(task, merchant_migration_id=migration.id)

    async def annotate_pan_step(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        key: str,
        *,
        note: str | None = None,
        expected_at: datetime | None = None,
        clear_expected_at: bool = False,
        in_progress: bool = False,
    ) -> PanTransferChecklist:
        """Say what a step we're waiting on is doing and when it should land, so a
        weeks-long wait reads as progress to the merchant instead of silence."""
        if not migration.pan_transfer_steps:
            raise PanTransferNotStarted()

        steps = pan_transfer.annotate(
            list(migration.pan_transfer_steps),
            key,
            note=note,
            expected_at=expected_at,
            clear_expected_at=clear_expected_at,
            in_progress=in_progress,
        )
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(migration, update_dict={"pan_transfer_steps": steps})
        return await self._checklist(session, migration, steps)

    async def run_card_verification(
        self, session: AsyncSession, migration_id: UUID, *, offset: int = 0
    ) -> None:
        """Link the cards that have landed on Polar to the imported
        subscriptions, a batch at a time (the `verify_cards` step).

        Entered from the `merchant_migration.verify_cards` job, which
        `_advance_checklist` enqueues when Ops completes the Stripe step before
        this one. Each batch enqueues the next.

        Read-only against the source and idempotent: re-running only picks up
        cards that arrived since, which is what lets the merchant re-run the copy
        for the customers it missed.
        """
        migration = await self._load(session, migration_id)
        if migration is None:
            return

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        records = await record_repository.list_imported_subscriptions(
            migration.id, offset=offset, limit=CARD_VERIFICATION_BATCH_SIZE
        )
        subscription_repository = SubscriptionRepository.from_session(session)
        for record in records:
            if record.target_id is None:
                continue
            subscription = await subscription_repository.get_by_id(
                record.target_id, options=(joinedload(Subscription.customer),)
            )
            # Already covered, or gone from Polar: nothing to link either way.
            if subscription is None or subscription.payment_method_id is not None:
                continue
            payment_method = await link_payment_method(session, subscription.customer)
            if payment_method is None:
                continue
            await subscription_repository.update(
                subscription, update_dict={"payment_method_id": payment_method.id}
            )

        if len(records) == CARD_VERIFICATION_BATCH_SIZE:
            enqueue_job(
                "merchant_migration.verify_cards",
                merchant_migration_id=migration.id,
                offset=offset + CARD_VERIFICATION_BATCH_SIZE,
            )
            return

        steps = self._complete_step(migration, STEP_VERIFY_CARDS)
        if steps is not None:
            await self._advance_checklist(session, migration, steps)

    def _complete_step(
        self, migration: MerchantMigration, key: str
    ) -> Sequence[PanTransferStep] | None:
        """Mark a step Polar performs as done, or None when it isn't ours to
        move — the work already finished once, or the merchant restarted."""
        current = pan_transfer.current(migration.pan_transfer_steps)
        if current is None or current.key != key:
            return None
        return pan_transfer.complete(
            migration.pan_transfer_method,
            list(migration.pan_transfer_steps),
            key,
            actor=PanStepActor.system,
            inputs={},
        )

    async def _load(
        self, session: AsyncReadSession, migration_id: UUID
    ) -> MerchantMigration | None:
        """Load a migration outside a request, for the background work. One
        deleted mid-run just stops the run."""
        migration = await MerchantMigrationRepository.from_session(session).get_by_id(
            migration_id
        )
        if migration is None:
            log.warning(
                "merchant_migration.missing", merchant_migration_id=migration_id
            )
        return migration

    async def _checklist(
        self,
        session: AsyncReadSession,
        migration: MerchantMigration,
        # `Sequence`, not `list`: this class defines a `list` method, which would
        # shadow the builtin in an annotation evaluated in the class body.
        steps: Sequence[PanTransferStep] | None = None,
    ) -> PanTransferChecklist:
        if steps is None:
            steps = migration.pan_transfer_steps
        current = pan_transfer.current(steps)
        return PanTransferChecklist(
            method=migration.pan_transfer_method,
            started=bool(steps),
            current_step_key=current.key if current is not None else None,
            destination_account_id=(
                settings.MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID or None
            ),
            card_coverage=await self._card_coverage(session, migration, steps),
            steps=steps,
        )

    async def _card_coverage(
        self,
        session: AsyncReadSession,
        migration: MerchantMigration,
        steps: Sequence[PanTransferStep],
    ) -> PanTransferCardCoverage | None:
        """What the card check found, once it has run. Counted on read rather
        than stored, so re-running the copy keeps the number honest."""
        if not self._step_completed(steps, STEP_VERIFY_CARDS):
            return None
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        covered, total = await record_repository.count_linked_payment_methods(
            migration.id
        )
        return PanTransferCardCoverage(covered=covered, total=total)

    def _step_completed(self, steps: Sequence[PanTransferStep], key: str) -> bool:
        return any(
            step.key == key and step.status == PanStepStatus.completed for step in steps
        )

    async def _get_manageable(
        self,
        # Widened for the read paths: `AsyncSession` is a `NewType` over
        # `AsyncReadSession`, so the write callers still type-check.
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

    async def _get_organization(
        self, session: AsyncReadSession, migration: MerchantMigration
    ) -> Organization:
        organization = await OrganizationRepository.from_session(session).get_by_id(
            migration.organization_id
        )
        if organization is None:
            raise MerchantMigrationNotFound()
        return organization

    async def list_records(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        entity: PrecheckEntity | None,
        status: PrecheckRecordStatus | None,
        reason_level: PrecheckReasonLevel | None = None,
        import_status: MerchantMigrationRecordStatus | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[MerchantMigrationRecordItem], int]:
        """Return staged records classified importable/skipped and paginated in
        memory. ``entity`` scopes to one type; ``None`` returns products, customers
        and subscriptions together. ``status`` filters to importable or skipped;
        ``reason_level`` filters to rows the merchant has to act on
        (`action_required`) or only needs to know about (`info`);
        ``import_status`` filters on the ledger outcome, which excludes price rows
        since they have none. Reads what ``run_precheck`` persisted."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        entities = [entity] if entity is not None else list(_ENTITY_RECORD_TYPE)
        items = await self._classify_staged(session, migration, entities)

        if status is not None:
            items = [item for item in items if item.status == status]
        if reason_level is not None:
            items = [item for item in items if item.reason_level == reason_level]
        if import_status is not None:
            items = [item for item in items if item.import_status == import_status]

        start = (pagination.page - 1) * pagination.limit
        return items[start : start + pagination.limit], len(items)

    async def _classify_staged(
        self,
        session: AsyncReadSession,
        migration: MerchantMigration,
        entities: Sequence[PrecheckEntity],
        # `Sequence`, not `list`: this class's own `list` method shadows it.
    ) -> Sequence[MerchantMigrationRecordItem]:
        """Load the staged catalog once and classify the requested entities.

        The expensive half of both listing and summarising, shared rather than
        repeated per caller.
        """
        organization = await self._get_organization(session, migration)

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        staged = await record_repository.list_by_migration(migration.id)
        records = [deserialize(record.type, record.canonical) for record in staged]
        # Only product classification consults it.
        existing_product_names: set[str] = set()
        if PrecheckEntity.products in entities:
            existing_product_names = await ProductRepository.from_session(
                session
            ).get_active_names_by_organization(migration.organization_id)

        items: list[MerchantMigrationRecordItem] = []
        for entity_type in entities:
            entity_items = classify_records(
                records,
                entity_type,
                organization.default_presentment_currency,
                existing_product_names,
            )
            self._attach_record_ids(entity_items, staged, entity_type)
            items.extend(entity_items)
        return items

    async def summarize_records(
        self,
        session: AsyncReadSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> MerchantMigrationRecordSummary:
        """Every count the review UI needs, from a single classification pass."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        entities = list(_ENTITY_RECORD_TYPE)
        items = await self._classify_staged(session, migration, entities)

        return MerchantMigrationRecordSummary(
            entities=_summarize_entities(items, entities),
            action_required=sum(
                1
                for item in items
                if item.reason_level == PrecheckReasonLevel.action_required
            ),
        )

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
    ) -> AsyncIterator[CanonicalRecord]:
        """Stage each record as it streams past, so we persist the catalog in
        the same single pass the precheck reads (extraction stays incremental)."""
        async for record in records:
            await record_repository.upsert(migration, organization, record)
            yield record

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
        return StripeSourceCredentials(
            api_key_encrypted=encrypted.encrypted_value,
            stripe_user_id=await adapter.get_account_id(),
            livemode=_is_live_key(api_key),
        )

    async def _assert_feature_enabled(
        self, session: AsyncReadSession, organization_id: UUID
    ) -> None:
        organization_repository = OrganizationRepository.from_session(session)
        organization = await organization_repository.get_by_id(organization_id)
        if organization is None or not organization.is_merchant_migration_enabled:
            raise MerchantMigrationNotEnabled()


merchant_migration = MerchantMigrationService()
