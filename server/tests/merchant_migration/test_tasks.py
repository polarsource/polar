from datetime import timedelta

import pytest
from dramatiq import Retry
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject
from polar.kit.utils import utc_now
from polar.merchant_migration.canonical import (
    CanonicalCustomer,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalRecord,
)
from polar.merchant_migration.operation import (
    STALL_THRESHOLD,
    MerchantMigrationOperationStatus,
    OperationInProgress,
    mark_running,
    new_pending_operation,
)
from polar.merchant_migration.repository import (
    MerchantMigrationRecordRepository,
    MerchantMigrationRepository,
)
from polar.merchant_migration.service import (
    merchant_migration as service,
)
from polar.merchant_migration.tasks import (
    merchant_migration_import,
    merchant_migration_precheck,
)
from polar.models import Organization, User, UserOrganization
from polar.models.merchant_migration import MerchantMigrationStep
from polar.models.merchant_migration_record import (
    MerchantMigrationRecordStatus,
    MerchantMigrationRecordType,
)
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.merchant_migration._helpers import (
    build_connected_migration,
    drain_precheck,
    run_import,
    run_precheck,
)
from tests.merchant_migration.test_service import (
    _catalog,
    _FakeAdapter,
    _importable_catalog,
)


def _many_customers(n: int) -> list[CanonicalRecord]:
    return [
        CanonicalCustomer(
            source_id=f"cus_{i}",
            email=f"user{i}@example.com",
            name=f"User {i}",
            country="US",
        )
        for i in range(n)
    ]


@pytest.mark.asyncio
class TestBackgroundPrecheck:
    @pytest.mark.auth
    async def test_pending_running_done_and_batching(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        records = _many_customers(5)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(records, batch_size=2),
        )
        enqueue = mocker.patch("polar.merchant_migration.service.enqueue_job")

        started = await service.start_precheck(session, auth_subject, migration.id)
        assert started.step == MerchantMigrationStep.pre_check
        assert started.operation is not None
        assert started.operation.status == MerchantMigrationOperationStatus.pending
        enqueue.assert_called_once_with("merchant_migration.precheck", migration.id)

        await service.process_precheck_batch(session, migration.id)
        repository = MerchantMigrationRepository.from_session(session)
        mid = await repository.get_by_id(migration.id)
        assert mid is not None
        assert mid.operation is not None
        assert mid.operation.status == MerchantMigrationOperationStatus.running
        assert mid.operation.cursor == {"offset": 2}

        finished = await drain_precheck(session, migration.id)
        assert finished.operation is not None
        assert finished.operation.status == MerchantMigrationOperationStatus.done
        assert finished.operation.cursor is None

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        staged = await record_repository.list_by_migration(migration.id)
        assert len(staged) == 5

    @pytest.mark.auth
    async def test_concurrent_start_returns_conflict(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter([]),
        )
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        await service.start_precheck(session, auth_subject, migration.id)

        with pytest.raises(OperationInProgress):
            await service.start_precheck(session, auth_subject, migration.id)


@pytest.mark.asyncio
class TestBackgroundImport:
    @pytest.mark.auth
    async def test_products_then_customers_then_subscriptions(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        from datetime import UTC, datetime

        from polar.merchant_migration.canonical import (
            CanonicalCollectionMethod,
            CanonicalSubscription,
            CanonicalSubscriptionStatus,
        )

        records: list[CanonicalRecord] = [
            CanonicalProduct(
                source_id="prod_1:month:1",
                product_source_id="prod_1",
                name="Pro",
                recurring_interval="month",
                recurring_interval_count=1,
                prices=[
                    CanonicalPrice(
                        source_id="price_1",
                        currency="usd",
                        amount=1000,
                        pricing_scheme=CanonicalPricingScheme.fixed,
                    )
                ],
            ),
            CanonicalCustomer(
                source_id="cus_1",
                email="alice@example.com",
                name="Alice",
                country="US",
            ),
            CanonicalSubscription(
                source_id="sub_1",
                customer_source_id="cus_1",
                price_source_id="price_1",
                status=CanonicalSubscriptionStatus.active,
                collection_method=CanonicalCollectionMethod.charge_automatically,
                current_period_start=datetime(2026, 1, 1, tzinfo=UTC),
                current_period_end=datetime(2026, 2, 1, tzinfo=UTC),
                trialing=False,
                paused_collection=False,
                line_item_count=1,
                quantity=1,
                payment_method=None,
            ),
        ]
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(records),
        )
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        await run_precheck(session, auth_subject, migration.id)

        await service.start_import(session, auth_subject, migration.id)

        # Force one-record batches so each type is its own transaction.
        mocker.patch(
            "polar.merchant_migration.service.IMPORT_BATCH_SIZE",
            1,
        )
        types_seen: list[str] = []
        for _ in range(10):
            repository = MerchantMigrationRepository.from_session(session)
            current = await repository.get_by_id(migration.id)
            assert current is not None
            assert current.operation is not None
            if current.operation.status == MerchantMigrationOperationStatus.done:
                break
            cursor = current.operation.cursor
            types_seen.append(
                "product" if cursor is None else str(cursor.get("type", "product"))
            )
            await service.process_import_batch(session, migration.id)

        collapsed: list[str] = []
        for value in types_seen:
            if not collapsed or collapsed[-1] != value:
                collapsed.append(value)
        assert collapsed == ["product", "customer", "subscription"]

    @pytest.mark.auth
    async def test_exclude_one_selection_stays_pending(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_importable_catalog()),
        )
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        await run_precheck(session, auth_subject, migration.id)

        record_repository = MerchantMigrationRecordRepository.from_session(session)
        customers = [
            r
            for r in await record_repository.list_by_migration(migration.id)
            if r.type == MerchantMigrationRecordType.customer
        ]
        assert len(customers) == 1
        excluded = customers[0]

        await run_import(
            session,
            auth_subject,
            migration.id,
            exclude_record_ids=[excluded.id],
        )

        refreshed = await record_repository.get_by_id(excluded.id)
        assert refreshed is not None
        assert refreshed.status == MerchantMigrationRecordStatus.pending

        # Partial re-import of the excluded row.
        await run_import(session, auth_subject, migration.id, record_ids=[excluded.id])
        refreshed = await record_repository.get_by_id(excluded.id)
        assert refreshed is not None
        assert refreshed.status == MerchantMigrationRecordStatus.imported

    @pytest.mark.auth
    async def test_stale_task_noops_when_done(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_catalog()),
        )
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        await run_precheck(session, auth_subject, migration.id)
        await run_import(session, auth_subject, migration.id)

        # A duplicate delivery after completion must not reopen the operation.
        await service.process_import_batch(session, migration.id)
        repository = MerchantMigrationRepository.from_session(session)
        updated = await repository.get_by_id(migration.id)
        assert updated is not None
        assert updated.operation is not None
        assert updated.operation.status == MerchantMigrationOperationStatus.done


@pytest.mark.asyncio
class TestTaskFailures:
    async def test_final_retry_marks_failed(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration,
            update_dict={
                "step": MerchantMigrationStep.pre_check,
                "operation": new_pending_operation(),
            },
        )

        mocker.patch(
            "polar.merchant_migration.tasks.AsyncSessionMaker",
            return_value=session,
        )
        # First open raises; final fail_operation uses a second session open.
        session_ctx = mocker.MagicMock()
        session_ctx.__aenter__ = mocker.AsyncMock(
            side_effect=[RuntimeError("boom"), session]
        )
        session_ctx.__aexit__ = mocker.AsyncMock(return_value=None)

        # Simpler: patch process to raise, can_retry False, and fail_operation real.
        mocker.patch(
            "polar.merchant_migration.tasks.merchant_migration_service.process_precheck_batch",
            side_effect=RuntimeError("boom"),
        )
        mocker.patch("polar.merchant_migration.tasks.can_retry", return_value=False)
        fail = mocker.patch(
            "polar.merchant_migration.tasks.merchant_migration_service.fail_operation",
            new_callable=mocker.AsyncMock,
        )

        with pytest.raises(RuntimeError, match="boom"):
            await merchant_migration_precheck(migration.id)

        fail.assert_awaited_once()
        assert fail.await_args is not None
        assert fail.await_args.args[1] == migration.id

    async def test_can_retry_raises_retry(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.tasks.merchant_migration_service.process_import_batch",
            side_effect=RuntimeError("transient"),
        )
        mocker.patch("polar.merchant_migration.tasks.can_retry", return_value=True)

        with pytest.raises(Retry):
            await merchant_migration_import(migration.id)


@pytest.mark.asyncio
class TestStallDetection:
    @pytest.mark.auth
    async def test_get_marks_stalled_operation_failed(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        migration = await build_connected_migration(save_fixture, organization)
        stalled = new_pending_operation()
        stalled = stalled.model_copy(
            update={
                "status": MerchantMigrationOperationStatus.running,
                "last_progress_at": utc_now() - STALL_THRESHOLD - timedelta(minutes=1),
            }
        )
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration,
            update_dict={
                "step": MerchantMigrationStep.pre_check,
                "operation": stalled,
            },
        )

        got = await service.get(session, auth_subject, migration.id)
        assert got is not None
        assert got.operation is not None
        assert got.operation.status == MerchantMigrationOperationStatus.failed
        assert got.operation.error is not None

    @pytest.mark.auth
    async def test_stall_does_not_overwrite_fresh_progress(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        from types import SimpleNamespace

        migration = await build_connected_migration(save_fixture, organization)
        stalled = new_pending_operation()
        stalled = stalled.model_copy(
            update={
                "status": MerchantMigrationOperationStatus.running,
                "last_progress_at": utc_now() - STALL_THRESHOLD - timedelta(minutes=1),
            }
        )
        repository = MerchantMigrationRepository.from_session(session)
        await repository.update(
            migration,
            update_dict={
                "step": MerchantMigrationStep.pre_check,
                "operation": stalled,
            },
        )

        # Worker progressed after the GET's initial stall check but before the
        # stalled UPDATE acquires the row lock.
        fresh = mark_running(stalled, cursor={"offset": 2})
        migration_id = migration.id
        await repository.update(migration, update_dict={"operation": fresh})
        await session.flush()
        session.expire(migration)

        # Stale in-memory view from the unlocked read that decided to stall.
        stale_view = SimpleNamespace(id=migration_id, operation=stalled)
        assert stalled.is_stalled()

        result = await service._apply_stall_if_needed(session, stale_view)  # type: ignore[arg-type]
        assert result.operation is not None
        assert result.operation.status == MerchantMigrationOperationStatus.running
        assert result.operation.cursor == {"offset": 2}


@pytest.mark.asyncio
class TestPanTransferGating:
    @pytest.mark.auth
    async def test_rejects_while_import_operation_active(
        self,
        mocker: MockerFixture,
        session: AsyncSession,
        save_fixture: SaveFixture,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        from polar.config import settings
        from polar.merchant_migration.pan_transfer import PanTransferNotReady

        mocker.patch.object(
            settings, "MERCHANT_MIGRATION_DESTINATION_STRIPE_ACCOUNT_ID", "acct_polar"
        )
        migration = await build_connected_migration(save_fixture, organization)
        mocker.patch(
            "polar.merchant_migration.service.StripeAdapter",
            return_value=_FakeAdapter(_importable_catalog()),
        )
        mocker.patch("polar.merchant_migration.service.enqueue_job")
        await run_precheck(session, auth_subject, migration.id)

        started = await service.start_import(session, auth_subject, migration.id)
        assert started.step == MerchantMigrationStep.create_catalog
        assert started.operation is not None
        assert started.operation.status == MerchantMigrationOperationStatus.pending

        with pytest.raises(PanTransferNotReady):
            await service.start_pan_transfer(session, auth_subject, migration.id)
