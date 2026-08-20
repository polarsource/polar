from collections.abc import AsyncIterator, Mapping, Sequence
from datetime import datetime
from typing import NamedTuple, TypedDict
from uuid import UUID

import stripe as stripe_lib
import structlog
from sqlalchemy.orm import joinedload

from polar.auth.models import AuthSubject, Organization, User
from polar.auth.permission import OrganizationPermission
from polar.authz.service import assert_organization_permission
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.kit.db.postgres import AsyncSession
from polar.kit.encryption import EncryptedString
from polar.kit.pagination import PaginationParams
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import (
    MerchantMigration,
    MerchantMigrationPaymentMethodMapping,
    MerchantMigrationRecord,
    PaymentMethod,
    Subscription,
)
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_operation import (
    MerchantMigrationOperation,
    MerchantMigrationOperationSelection,
    MerchantMigrationOperationStatus,
)
from polar.models.merchant_migration_record import (
    MerchantMigrationCutoverStatus,
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
from .canonical import (
    CanonicalPaymentMethod,
    CanonicalRecord,
    CanonicalSubscription,
    deserialize,
)
from .cards import (
    CopiedCardResolutionError,
    PaymentMethodMappingCSVError,
    PaymentMethodMappingLike,
    link_payment_method,
    parse_payment_method_mapping_csv,
)
from .cutover import SubscriptionCutover
from .errors import MerchantMigrationError
from .importer import CatalogImporter
from .pan_transfer import (
    STEP_CUTOVER,
    STEP_MOVE_SUBSCRIPTIONS,
    STEP_VERIFY_CARDS,
    PanStepActor,
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
    MerchantMigrationPaymentMethodMappingRepository,
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from .schemas import (
    MerchantMigrationCreate,
    MerchantMigrationCutoverReport,
    MerchantMigrationImportReport,
    MerchantMigrationRecordItem,
    MerchantMigrationRecordSummary,
    MerchantMigrationRecordSummaryEntity,
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

# Entities whose records map 1:1 to a ledger row. Prices live inside a product
# record and are excluded.
_ENTITY_RECORD_TYPE = {
    PrecheckEntity.products: MerchantMigrationRecordType.product,
    PrecheckEntity.customers: MerchantMigrationRecordType.customer,
    PrecheckEntity.subscriptions: MerchantMigrationRecordType.subscription,
}

SOURCE_CREDENTIALS_ENCRYPTION_CONTEXT = {
    "table": "merchant_migrations",
    "column": "source_credentials",
}

_STEP_TASKS = {
    STEP_VERIFY_CARDS: "merchant_migration.verify_cards",
    STEP_MOVE_SUBSCRIPTIONS: "merchant_migration.cutover",
}

_MIGRATION_STEP_BY_PAN_STEP = {
    STEP_MOVE_SUBSCRIPTIONS: MerchantMigrationStep.activate_subscriptions,
}

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


class CutoverNotStarted(MerchantMigrationError):
    def __init__(self) -> None:
        super().__init__(
            "Reach the switch step in the card transfer before switching "
            "subscriptions over.",
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


class _CardLookup(NamedTuple):
    """What one `link_payment_method` call is decided by, and so what a second
    call with the same values would repeat."""

    customer_id: UUID
    source_method_id: str | None


type ResolvedCards = dict[_CardLookup, PaymentMethod | None]


def _staged_subscription(
    record: MerchantMigrationRecord,
) -> CanonicalSubscription | None:
    """The canonical subscription staged for a record, or None when the record
    isn't a subscription or its blob can't be read."""
    try:
        staged = deserialize(record.type, record.canonical)
    except KeyError, TypeError, ValueError:
        return None
    return staged if isinstance(staged, CanonicalSubscription) else None


def _staged_payment_method(
    record: MerchantMigrationRecord,
) -> CanonicalPaymentMethod | None:
    """What the source subscription was charging, so the right copy is picked
    when a customer has more than one."""
    staged = _staged_subscription(record)
    return staged.payment_method if staged is not None else None


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
        return self._checklist(migration)

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
        return self._checklist(migration, steps)

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
        return self._checklist(migration, steps)

    async def _advance_checklist(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        steps: Sequence[PanTransferStep],
    ) -> None:
        """Persist progress and start work for the current Polar-managed step."""
        current = pan_transfer.current(steps)
        update_dict: dict[str, object] = {"pan_transfer_steps": list(steps)}
        if current is not None:
            migration_step = _MIGRATION_STEP_BY_PAN_STEP.get(current.key)
            if migration_step is not None:
                update_dict["step"] = migration_step
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(migration, update_dict=update_dict)

        task = _STEP_TASKS.get(current.key) if current else None
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
        return self._checklist(migration, steps)

    async def import_payment_method_mappings(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        contents: bytes,
    ) -> int:
        mappings = parse_payment_method_mapping_csv(contents)
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        customers = await record_repository.imported_customers_by_source_ids(
            migration.organization_id,
            [mapping.source_customer_id for mapping in mappings],
        )
        if not customers:
            raise PaymentMethodMappingCSVError(
                "None of the source customers in this CSV were imported by Polar."
            )

        customer_repository = CustomerRepository.from_session(session)
        destination_customer_ids = {
            mapping.source_customer_id: mapping.destination_customer_id
            for mapping in mappings
        }
        for source_customer_id, customer in customers.items():
            destination_customer_id = destination_customer_ids[source_customer_id]
            if customer.stripe_customer_id not in (
                None,
                source_customer_id,
                destination_customer_id,
            ):
                raise PaymentMethodMappingCSVError(
                    f"Imported customer {source_customer_id} is already linked to a "
                    "different Stripe customer."
                )
        for source_customer_id, customer in customers.items():
            destination_customer_id = destination_customer_ids[source_customer_id]
            if customer.stripe_customer_id != destination_customer_id:
                await customer_repository.update(
                    customer,
                    update_dict={"stripe_customer_id": destination_customer_id},
                )

        repository = MerchantMigrationPaymentMethodMappingRepository.from_session(
            session
        )
        await repository.replace(
            migration,
            [
                MerchantMigrationPaymentMethodMapping(
                    merchant_migration=migration,
                    source_customer_id=mapping.source_customer_id,
                    source_payment_method_id=mapping.source_payment_method_id,
                    destination_customer_id=mapping.destination_customer_id,
                    destination_payment_method_id=mapping.destination_payment_method_id,
                )
                for mapping in mappings
            ],
        )
        return len(mappings)

    async def run_card_verification(
        self, session: AsyncSession, migration_id: UUID, *, offset: int = 0
    ) -> None:
        repository = MerchantMigrationRepository.from_session(session)
        migration = await repository.get_by_id(migration_id)
        if migration is None:
            log.warning(
                "merchant_migration.missing", merchant_migration_id=migration_id
            )
            return

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        records = await record_repository.list_imported_subscriptions(
            migration.id, offset=offset, limit=CARD_VERIFICATION_BATCH_SIZE
        )
        staged = [_staged_subscription(record) for record in records]
        source_payment_method_ids = [
            subscription.payment_method.source_id
            for subscription in staged
            if subscription is not None and subscription.payment_method is not None
        ]
        mapping_repository = (
            MerchantMigrationPaymentMethodMappingRepository.from_session(session)
        )
        stored_mappings = await mapping_repository.list_by_source_payment_method_ids(
            migration.id, source_payment_method_ids
        )
        mappings = {
            mapping.source_payment_method_id: mapping for mapping in stored_mappings
        }
        mappings_uploaded = bool(stored_mappings) or await mapping_repository.has_any(
            migration.id
        )
        subscription_repository = SubscriptionRepository.from_session(session)
        resolved: ResolvedCards = {}
        for record in records:
            if record.target_id is None:
                continue
            subscription = await subscription_repository.get_by_id(
                record.target_id, options=(joinedload(Subscription.customer),)
            )
            if subscription is None:
                continue
            if subscription.payment_method_id is not None and not mappings_uploaded:
                continue
            payment_method = await self._resolve_card(
                session,
                record,
                subscription,
                resolved,
                mappings=mappings,
                mappings_uploaded=mappings_uploaded,
            )
            if payment_method is not None:
                await subscription_repository.update(
                    subscription, update_dict={"payment_method_id": payment_method.id}
                )
            elif mappings_uploaded and subscription.payment_method_id is not None:
                await subscription_repository.update(
                    subscription, update_dict={"payment_method_id": None}
                )

        if len(records) == CARD_VERIFICATION_BATCH_SIZE:
            enqueue_job(
                "merchant_migration.verify_cards",
                merchant_migration_id=migration.id,
                offset=offset + CARD_VERIFICATION_BATCH_SIZE,
            )
            return

        await repository.refresh_for_update(migration)
        await self._complete_step(session, migration, STEP_VERIFY_CARDS)

    async def _resolve_card(
        self,
        session: AsyncSession,
        record: MerchantMigrationRecord,
        subscription: Subscription,
        resolved: ResolvedCards,
        *,
        mappings: Mapping[str, PaymentMethodMappingLike],
        mappings_uploaded: bool,
    ) -> PaymentMethod | None:
        """The method to charge, resolved once per customer and source method
        rather than once per subscription they hold."""
        source_method = _staged_payment_method(record)
        staged = _staged_subscription(record)
        key = _CardLookup(
            customer_id=subscription.customer_id,
            source_method_id=source_method.source_id if source_method else None,
        )
        if key not in resolved:
            mapping = (
                mappings.get(source_method.source_id)
                if source_method is not None
                else None
            )
            if (
                mapping is not None
                and staged is not None
                and mapping.source_customer_id != staged.customer_source_id
            ):
                mapping = None
            if mappings_uploaded and mapping is None:
                resolved[key] = None
                return None
            try:
                resolved[key] = await link_payment_method(
                    session,
                    subscription.customer,
                    source_method=source_method,
                    mapping=mapping,
                )
            except CopiedCardResolutionError as e:
                log.error(
                    "merchant_migration.verify_cards.card_resolution_error",
                    merchant_migration_id=record.merchant_migration_id,
                    record_id=record.id,
                    customer_id=subscription.customer_id,
                    error=str(e),
                )
                resolved[key] = None
        return resolved[key]

    async def _complete_step(
        self, session: AsyncSession, migration: MerchantMigration, key: str
    ) -> None:
        """Mark a step Polar performs as done. A no-op when it isn't ours to
        move — the work already finished once, or the merchant restarted."""
        current = pan_transfer.current(migration.pan_transfer_steps)
        if current is None or current.key != key:
            return
        steps = pan_transfer.complete(
            migration.pan_transfer_method,
            list(migration.pan_transfer_steps),
            key,
            actor=PanStepActor.system,
            inputs={},
        )
        await self._advance_checklist(session, migration, steps)

    async def get_cutover_report(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
    ) -> MerchantMigrationCutoverReport:
        migration = await self._get_manageable(session, auth_subject, migration_id)
        await self._fail_stalled_cutover(session, migration)
        return await self._cutover_report(session, migration)

    async def start_cutover(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        migration_id: UUID,
        *,
        record_ids: Sequence[UUID] | None = None,
        exclude_record_ids: Sequence[UUID] | None = None,
    ) -> MerchantMigrationCutoverReport:
        """Switch the picked imported subscriptions over to Polar.

        Serves both the first confirmation and every retry: records the
        selection, re-opens skipped/failed rows, and kicks the worker. Only
        reachable once the card checklist has advanced to the switch step.
        """
        migration = await self._get_manageable(
            session, auth_subject, migration_id, for_update=True
        )
        if not self._cutover_reachable(migration):
            raise CutoverNotStarted()

        selection = self._build_selection(record_ids, exclude_record_ids)
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        await record_repository.reset_cutover(migration.id, selection)

        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration,
            update_dict={
                "operation": MerchantMigrationOperation(
                    status=MerchantMigrationOperationStatus.running,
                    selection=selection,
                    last_progress_at=utc_now(),
                )
            },
        )

        current = pan_transfer.current(migration.pan_transfer_steps)
        if current is not None and current.key == STEP_CUTOVER:
            await self._complete_pan_step(
                session,
                migration,
                STEP_CUTOVER,
                actor=PanStepActor.merchant,
                inputs={},
            )
        else:
            enqueue_job(
                "merchant_migration.cutover", merchant_migration_id=migration.id
            )
        return await self._cutover_report(session, migration)

    async def run_cutover(self, session: AsyncSession, migration_id: UUID) -> None:
        """Switch one subscription over, then hand off to the next run.

        One subscription per run, each in its own transaction: the irreversible
        half is a cancellation on the merchant's provider, so a batch that dies
        halfway must not replay cancellations it already committed.
        """
        migration = await self._load(session, migration_id)
        if migration is None:
            return
        operation = migration.operation
        if operation is not None and not operation.is_active:
            return
        if not self._cutover_started(migration):
            log.warning(
                "merchant_migration.cutover.not_confirmed",
                merchant_migration_id=migration.id,
            )
            return
        organization = await self._get_organization(session, migration)
        if not organization.can_renew_subscriptions:
            log.warning(
                "merchant_migration.cutover.renewals_disabled",
                merchant_migration_id=migration.id,
                organization_id=organization.id,
            )
            await self._fail_cutover(
                session,
                migration,
                "Organization renewals are disabled; subscriptions stay on the source.",
            )
            return

        selection = (
            migration.operation.selection if migration.operation is not None else None
        )
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        record = await record_repository.get_next_cutover_candidate(
            migration.id, selection
        )
        if record is None:
            if await record_repository.has_pending_cutover_candidates(
                migration.id, selection
            ):
                return
            await self._finish_cutover(session, migration)
            return

        outcome = await SubscriptionCutover(
            session, migration, await self._build_adapter(migration)
        ).run(record)
        await record_repository.update(
            record,
            update_dict={
                "cutover_status": outcome.status,
                "cutover_error": outcome.message,
            },
        )
        await self._bump_operation(session, migration)
        enqueue_job("merchant_migration.cutover", merchant_migration_id=migration.id)

    async def _finish_cutover(
        self, session: AsyncSession, migration: MerchantMigration
    ) -> None:
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        selection = (
            migration.operation.selection if migration.operation is not None else None
        )
        counts = await record_repository.count_cutover_statuses(migration.id, selection)
        completed_steps = self._complete_polar_app_step(
            migration, STEP_MOVE_SUBSCRIPTIONS
        )
        update_dict: dict[str, object] = {
            "operation": self._done_operation(migration),
            "step": MerchantMigrationStep.cleanup,
        }
        if completed_steps is not None:
            # `annotate` refuses a completed step, so the receipt note goes on
            # the step object directly before the completion is persisted.
            steps = list(completed_steps)
            note = self._cutover_note(counts)
            for step in steps:
                if step.key == STEP_MOVE_SUBSCRIPTIONS:
                    step.note = note
            update_dict["pan_transfer_steps"] = steps
        await MerchantMigrationRepository.from_session(session).update(
            migration, update_dict=update_dict
        )

    async def _fail_cutover(
        self,
        session: AsyncSession,
        migration: MerchantMigration,
        error: str,
    ) -> None:
        await MerchantMigrationRepository.from_session(session).update(
            migration,
            update_dict={"operation": self._failed_operation(migration, error)},
        )

    async def _fail_stalled_cutover(
        self, session: AsyncSession, migration: MerchantMigration
    ) -> None:
        operation = migration.operation
        if operation is None or not operation.is_stalled():
            return
        await self._fail_cutover(
            session,
            migration,
            "Switch stalled with no progress; start it again to resume.",
        )

    def _complete_polar_app_step(
        self,
        migration: MerchantMigration,
        key: str,
        # `Sequence`, not `list`: this class defines a `list` method, which would
        # shadow the builtin in an annotation evaluated in the class body.
    ) -> Sequence[PanTransferStep] | None:
        """Mark a step Polar performs as done, or None when it isn't ours to move
        — the work already finished once, or the merchant restarted."""
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

    async def _bump_operation(
        self, session: AsyncSession, migration: MerchantMigration
    ) -> None:
        """Refresh ``last_progress_at`` so a hang past ``STALL_THRESHOLD`` is
        detectable on the next report poll."""
        operation = migration.operation
        if operation is None:
            return
        updated = operation.model_copy(update={"last_progress_at": utc_now()})
        await MerchantMigrationRepository.from_session(session).update(
            migration, update_dict={"operation": updated}
        )

    def _done_operation(
        self, migration: MerchantMigration
    ) -> MerchantMigrationOperation:
        operation = migration.operation
        if operation is None:
            return MerchantMigrationOperation(
                status=MerchantMigrationOperationStatus.done,
                last_progress_at=utc_now(),
            )
        return operation.model_copy(
            update={
                "status": MerchantMigrationOperationStatus.done,
                "last_progress_at": utc_now(),
            }
        )

    def _failed_operation(
        self, migration: MerchantMigration, error: str
    ) -> MerchantMigrationOperation:
        operation = migration.operation
        if operation is None:
            return MerchantMigrationOperation(
                status=MerchantMigrationOperationStatus.failed,
                error=error,
                last_progress_at=utc_now(),
            )
        return operation.model_copy(
            update={
                "status": MerchantMigrationOperationStatus.failed,
                "error": error,
                "last_progress_at": utc_now(),
            }
        )

    def _cutover_note(
        self, counts: dict[MerchantMigrationCutoverStatus | None, int]
    ) -> str:
        moved = counts.get(MerchantMigrationCutoverStatus.moved, 0)
        left = counts.get(MerchantMigrationCutoverStatus.skipped, 0) + counts.get(
            MerchantMigrationCutoverStatus.failed, 0
        )
        note = (
            f"Polar now bills {moved} subscription(s), and stopped them on your source."
        )
        if left:
            note += (
                f" {left} stayed on your source; open the subscriptions list to "
                "see why, and switch them again once they're sorted."
            )
        return note

    async def _cutover_report(
        self, session: AsyncReadSession, migration: MerchantMigration
    ) -> MerchantMigrationCutoverReport:
        # Catalog-wide counts so the switch table tabs match every imported row,
        # even when the active run only covers a selection. The finish note still
        # scopes to the selection via `_finish_cutover`.
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        counts = await record_repository.count_cutover_statuses(migration.id)
        operation = migration.operation
        return MerchantMigrationCutoverReport(
            started=self._cutover_started(migration),
            running=operation.is_active if operation is not None else False,
            completed=operation.is_terminal if operation is not None else False,
            total=sum(counts.values()),
            pending=counts.get(None, 0),
            moved=counts.get(MerchantMigrationCutoverStatus.moved, 0),
            skipped=counts.get(MerchantMigrationCutoverStatus.skipped, 0),
            failed=counts.get(MerchantMigrationCutoverStatus.failed, 0),
        )

    def _build_selection(
        self,
        record_ids: Sequence[UUID] | None,
        exclude_record_ids: Sequence[UUID] | None,
    ) -> MerchantMigrationOperationSelection | None:
        if record_ids is not None:
            return MerchantMigrationOperationSelection(record_ids=list(record_ids))
        if exclude_record_ids is not None:
            return MerchantMigrationOperationSelection(
                exclude_record_ids=list(exclude_record_ids)
            )
        return None

    def _cutover_reachable(self, migration: MerchantMigration) -> bool:
        """The merchant may switch once the card checklist has reached the switch
        step — either it's the one to act on now, or it was confirmed already."""
        current = pan_transfer.current(migration.pan_transfer_steps)
        if current is not None and current.key == STEP_CUTOVER:
            return True
        return self._cutover_started(migration)

    def _cutover_started(self, migration: MerchantMigration) -> bool:
        """The merchant has confirmed the switch step, so Polar is allowed to
        stop subscriptions on their source."""
        return self._step_completed(migration, STEP_CUTOVER)

    def _step_completed(self, migration: MerchantMigration, key: str) -> bool:
        return any(
            step.key == key and step.status == PanStepStatus.completed
            for step in migration.pan_transfer_steps
        )

    async def _load(
        self, session: AsyncReadSession, migration_id: UUID
    ) -> MerchantMigration | None:
        """Load a migration outside a request, for the background work. A
        migration deleted mid-run just stops the run."""
        migration = await MerchantMigrationRepository.from_session(session).get_by_id(
            migration_id
        )
        if migration is None:
            log.warning(
                "merchant_migration.missing", merchant_migration_id=migration_id
            )
        return migration

    def _checklist(
        self,
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
            steps=steps,
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
        cutover_status: MerchantMigrationCutoverStatus | None = None,
        pagination: PaginationParams,
    ) -> tuple[Sequence[MerchantMigrationRecordItem], int]:
        """Return staged records classified importable/skipped and paginated in
        memory. ``entity`` scopes to one type; ``None`` returns products, customers
        and subscriptions together. ``status`` filters to importable or skipped;
        ``reason_level`` filters to rows the merchant has to act on
        (`action_required`) or only needs to know about (`info`);
        ``import_status`` filters on the ledger outcome, which excludes price rows
        since they have none; ``cutover_status`` narrows to what the switch did
        with a subscription, which is how the merchant finds the ones it left on
        the source. Reads what ``run_precheck`` persisted."""
        migration = await self._get_manageable(session, auth_subject, migration_id)
        entities = [entity] if entity is not None else list(_ENTITY_RECORD_TYPE)
        items = await self._classify_staged(session, migration, entities)
        await self._attach_cutover_coverage(session, migration, items)

        if status is not None:
            items = [item for item in items if item.status == status]
        if reason_level is not None:
            items = [item for item in items if item.reason_level == reason_level]
        if import_status is not None:
            items = [item for item in items if item.import_status == import_status]
        if cutover_status is not None:
            items = [item for item in items if item.cutover_status == cutover_status]

        start = (pagination.page - 1) * pagination.limit
        return items[start : start + pagination.limit], len(items)

    async def _attach_cutover_coverage(
        self,
        session: AsyncReadSession,
        migration: MerchantMigration,
        items: Sequence[MerchantMigrationRecordItem],
    ) -> None:
        """Flag which imported subscriptions already have a payment method to
        charge, so the switch table can hint readiness before the merchant picks.
        """
        if not any(item.entity == PrecheckEntity.subscriptions for item in items):
            return
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        covered = await record_repository.payment_method_coverage(migration.id)
        for item in items:
            if (
                item.entity != PrecheckEntity.subscriptions
                or item.import_status != MerchantMigrationRecordStatus.imported
            ):
                continue
            item.has_payment_method = item.record_id in covered

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
            if entity == PrecheckEntity.subscriptions:
                item.cutover_status = record.cutover_status
                item.cutover_error = record.cutover_error
                item.renews_at = self._staged_renews_at(record)

    def _staged_renews_at(self, record: MerchantMigrationRecord) -> datetime | None:
        """When the source subscription renews, as captured at import. Best-effort:
        an unreadable blob just leaves the column blank."""
        staged = _staged_subscription(record)
        return staged.current_period_end if staged is not None else None

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
