from collections.abc import AsyncGenerator
from datetime import timedelta

import httpx
import pytest
import pytest_asyncio

from polar.backoffice import app as backoffice_app
from polar.backoffice.dependencies import get_admin
from polar.kit.utils import utc_now
from polar.merchant_migration import pan_transfer
from polar.merchant_migration.canonical import (
    CanonicalCollectionMethod,
    CanonicalCustomer,
    CanonicalPrice,
    CanonicalPricingScheme,
    CanonicalProduct,
    CanonicalSubscription,
    CanonicalSubscriptionStatus,
)
from polar.merchant_migration.pan_transfer import (
    PanStepActor,
    PanStepOwner,
    PanStepStatus,
    PanTransferMethod,
    PanTransferStep,
)
from polar.merchant_migration.repository import MerchantMigrationRecordRepository
from polar.models import MerchantMigration, Organization, User
from polar.models.merchant_migration import (
    MerchantMigrationSourcePlatform,
    MerchantMigrationStep,
)
from polar.models.merchant_migration_record import MerchantMigrationRecordStatus
from polar.models.user_session import UserSession
from polar.postgres import AsyncSession, get_db_read_session, get_db_session
from tests.fixtures.database import SaveFixture


@pytest_asyncio.fixture
async def backoffice_client(
    session: AsyncSession, user: User
) -> AsyncGenerator[httpx.AsyncClient]:
    user_session = UserSession(token="0" * 64, user_agent="tests", user=user)
    backoffice_app.dependency_overrides[get_db_session] = lambda: session
    backoffice_app.dependency_overrides[get_db_read_session] = lambda: session
    backoffice_app.dependency_overrides[get_admin] = lambda: user_session
    try:
        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=backoffice_app),
            base_url="http://test",
        ) as client:
            yield client
    finally:
        backoffice_app.dependency_overrides.pop(get_db_session, None)
        backoffice_app.dependency_overrides.pop(get_db_read_session, None)
        backoffice_app.dependency_overrides.pop(get_admin, None)


async def _create_migration(
    save_fixture: SaveFixture,
    organization: Organization,
    *,
    step: MerchantMigrationStep = MerchantMigrationStep.source_setup,
    steps: list[PanTransferStep] | None = None,
) -> MerchantMigration:
    migration = MerchantMigration(
        organization=organization,
        source_platform=MerchantMigrationSourcePlatform.stripe,
        step=step,
        pan_transfer_steps=steps or [],
    )
    await save_fixture(migration)
    return migration


def _advance_to(key: str) -> list[PanTransferStep]:
    steps = pan_transfer.build(PanTransferMethod.pan_copy)
    while True:
        current = pan_transfer.current(steps)
        assert current is not None
        if current.key == key:
            return steps
        actor = (
            PanStepActor.system
            if current.owner == PanStepOwner.polar_app
            else PanStepActor.ops
        )
        steps = pan_transfer.complete(
            PanTransferMethod.pan_copy, steps, current.key, actor=actor, inputs={}
        )


async def _post_action(
    client: httpx.AsyncClient, url: str, data: dict[str, str] | None = None
) -> httpx.Response:
    """POST the way htmx does, and assert the browser is sent back to the detail
    page — without the `HX-Redirect` header the operator keeps staring at the
    pre-action page."""
    response = await client.post(url, data=data or {}, headers={"HX-Request": "true"})

    assert response.status_code == 200
    assert "merchant-migrations" in response.headers["HX-Redirect"]
    return response


async def _reload(session: AsyncSession, migration: MerchantMigration) -> None:
    """Round-trip the migration through the database.

    Flush first: `refresh` expires the instance, which would throw away the
    request's pending change instead of writing it, and we'd read back the old
    row and think nothing was saved.
    """
    await session.flush()
    await session.refresh(migration)


@pytest.mark.asyncio
class TestList:
    async def test_lists_a_migration_with_its_organization(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_migration(save_fixture, organization)

        response = await backoffice_client.get("/merchant-migrations/")

        assert response.status_code == 200
        assert organization.name in response.text

    async def test_needs_ops_view_hides_a_migration_waiting_on_the_merchant(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("start_copy"),
        )

        response = await backoffice_client.get(
            "/merchant-migrations/", params={"view": "needs_ops"}
        )

        assert response.status_code == 200
        assert "No migrations in this view." in response.text

    async def test_needs_ops_view_shows_an_ops_owned_step(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("authorize_copy"),
        )

        response = await backoffice_client.get(
            "/merchant-migrations/", params={"view": "needs_ops"}
        )

        assert response.status_code == 200
        assert organization.name in response.text
        assert "Ops action" in response.text

    async def test_completed_view_excludes_running_migrations(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_migration(save_fixture, organization)

        response = await backoffice_client.get(
            "/merchant-migrations/", params={"view": "completed"}
        )

        assert response.status_code == 200
        assert "No migrations in this view." in response.text


async def _stage_monthly_subscription(
    session: AsyncSession,
    migration: MerchantMigration,
    organization: Organization,
    *,
    amount: int,
    status: MerchantMigrationRecordStatus,
) -> None:
    """One product priced monthly plus a subscription on it, so the page has MRR."""
    record_repository = MerchantMigrationRecordRepository.from_session(session)
    product = await record_repository.upsert(
        migration,
        organization,
        CanonicalProduct(
            source_id="prod_1:month",
            product_source_id="prod_1",
            name="Pro",
            recurring_interval="month",
            recurring_interval_count=1,
            prices=[
                CanonicalPrice(
                    source_id="price_1",
                    currency="usd",
                    amount=amount,
                    pricing_scheme=CanonicalPricingScheme.fixed,
                )
            ],
        ),
    )
    await record_repository.update(
        product,
        update_dict={"status": MerchantMigrationRecordStatus.imported},
        flush=True,
    )
    subscription = await record_repository.upsert(
        migration,
        organization,
        CanonicalSubscription(
            source_id="sub_1",
            customer_source_id="cus_1",
            price_source_id="price_1",
            status=CanonicalSubscriptionStatus.active,
            collection_method=CanonicalCollectionMethod.charge_automatically,
            current_period_start=None,
            current_period_end=None,
            trialing=False,
            paused_collection=False,
            line_item_count=1,
            quantity=1,
            payment_method=None,
        ),
    )
    await record_repository.update(
        subscription, update_dict={"status": status}, flush=True
    )


@pytest.mark.asyncio
class TestMrr:
    async def test_list_shows_the_monthly_total(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        await _stage_monthly_subscription(
            session,
            migration,
            organization,
            amount=2900,
            status=MerchantMigrationRecordStatus.imported,
        )

        response = await backoffice_client.get(
            "/merchant-migrations/", params={"view": "all"}
        )

        assert response.status_code == 200
        assert "$29.00 /mo" in response.text
        assert "100% on Polar" in response.text

    async def test_detail_splits_moved_from_still_to_move(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        await _stage_monthly_subscription(
            session,
            migration,
            organization,
            amount=5000,
            status=MerchantMigrationRecordStatus.pending,
        )

        response = await backoffice_client.get(f"/merchant-migrations/{migration.id}")

        assert response.status_code == 200
        assert "MRR at stake" in response.text
        assert "Still to move" in response.text
        assert "$50.00" in response.text
        assert "0% of the migration" in response.text

    async def test_a_migration_with_no_subscriptions_says_so(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        await _create_migration(save_fixture, organization)

        response = await backoffice_client.get(
            "/merchant-migrations/", params={"view": "all"}
        )

        assert response.status_code == 200
        assert "No recurring revenue staged" in response.text


@pytest.mark.asyncio
class TestDetail:
    async def test_shows_the_checklist_and_the_ops_action(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("authorize_copy"),
        )

        response = await backoffice_client.get(f"/merchant-migrations/{migration.id}")

        assert response.status_code == 200
        assert "Accept the incoming copy" in response.text
        assert "Ops action needed" in response.text
        assert "Complete step" in response.text

    async def test_says_the_card_transfer_has_not_started(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture, organization, step=MerchantMigrationStep.create_catalog
        )

        response = await backoffice_client.get(f"/merchant-migrations/{migration.id}")

        assert response.status_code == 200
        assert "hasn't started the card transfer yet" in response.text

    async def test_lists_failed_records_with_their_error(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(save_fixture, organization)
        record_repository = MerchantMigrationRecordRepository.from_session(session)
        record = await record_repository.upsert(
            migration,
            organization,
            CanonicalCustomer(
                source_id="cus_1", email="a@example.com", name="A", country="US"
            ),
        )
        await record_repository.update(
            record,
            update_dict={
                "status": MerchantMigrationRecordStatus.failed,
                "error": "Stripe said no",
            },
            flush=True,
        )

        response = await backoffice_client.get(f"/merchant-migrations/{migration.id}")

        assert response.status_code == 200
        assert "Failed records" in response.text
        assert "Stripe said no" in response.text
        assert "cus_1" in response.text

    async def test_unknown_migration_is_not_found(
        self, backoffice_client: httpx.AsyncClient
    ) -> None:
        response = await backoffice_client.get(
            f"/merchant-migrations/{MerchantMigration.generate_id()}"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestCompleteStep:
    async def test_completes_an_ops_owned_step(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("authorize_copy"),
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/authorize_copy/complete",
        )

        await _reload(session, migration)
        completed = next(
            step
            for step in migration.pan_transfer_steps
            if step.key == "authorize_copy"
        )
        assert completed.status == PanStepStatus.completed
        assert completed.completed_by == PanStepActor.ops
        current = pan_transfer.current(migration.pan_transfer_steps)
        assert current is not None
        assert current.key == "stripe_copy"

    async def test_stores_the_inputs_the_step_collects(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("start_copy"),
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/start_copy/complete",
            {"stripe_migration_request_id": "mig_123"},
        )

        await _reload(session, migration)
        step = next(
            step for step in migration.pan_transfer_steps if step.key == "start_copy"
        )
        assert step.inputs == {"stripe_migration_request_id": "mig_123"}

    async def test_warns_when_completing_on_the_merchants_behalf(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("start_copy"),
        )

        response = await backoffice_client.get(
            f"/merchant-migrations/{migration.id}/steps/start_copy/complete"
        )

        assert response.status_code == 200
        assert "on the merchant's behalf" in response.text

    async def test_a_step_that_is_not_current_is_refused(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("start_copy"),
        )

        response = await backoffice_client.post(
            f"/merchant-migrations/{migration.id}/steps/cutover/complete",
            headers={"HX-Request": "true"},
        )

        assert response.status_code == 200
        await _reload(session, migration)
        cutover = next(
            step for step in migration.pan_transfer_steps if step.key == "cutover"
        )
        assert cutover.status == PanStepStatus.blocked

    async def test_unknown_step_is_not_found(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("start_copy"),
        )

        response = await backoffice_client.post(
            f"/merchant-migrations/{migration.id}/steps/not_a_step/complete"
        )

        assert response.status_code == 404


@pytest.mark.asyncio
class TestAnnotateStep:
    async def test_saves_the_note_and_the_expected_date(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=_advance_to("stripe_copy"),
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/stripe_copy/annotate",
            {
                "note": "Stripe is on it.",
                "expected_at": "2026-09-01",
                "in_progress": "on",
            },
        )

        await _reload(session, migration)
        step = next(
            step for step in migration.pan_transfer_steps if step.key == "stripe_copy"
        )
        assert step.note == "Stripe is on it."
        assert step.expected_at is not None
        assert step.expected_at.date().isoformat() == "2026-09-01"
        assert step.status == PanStepStatus.in_progress

    async def test_an_empty_note_clears_the_previous_one(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"), "stripe_copy", note="Stale note"
        )
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=steps,
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/stripe_copy/annotate",
            {"note": "", "expected_at": ""},
        )

        await _reload(session, migration)
        step = next(
            step for step in migration.pan_transfer_steps if step.key == "stripe_copy"
        )
        assert step.note is None

    async def test_clearing_the_date_drops_the_eta(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"),
            "stripe_copy",
            expected_at=utc_now() + timedelta(days=3),
        )
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=steps,
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/stripe_copy/annotate",
            {"note": "Stripe can't give a date.", "expected_at": ""},
        )

        await _reload(session, migration)
        step = next(
            step for step in migration.pan_transfer_steps if step.key == "stripe_copy"
        )
        assert step.expected_at is None

    async def test_marking_an_already_running_step_in_progress_is_a_no_op(
        self,
        session: AsyncSession,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"), "stripe_copy", in_progress=True
        )
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=steps,
        )

        await _post_action(
            backoffice_client,
            f"/merchant-migrations/{migration.id}/steps/stripe_copy/annotate",
            {"note": "Still waiting", "in_progress": "on"},
        )

        await _reload(session, migration)
        step = next(
            step for step in migration.pan_transfer_steps if step.key == "stripe_copy"
        )
        assert step.status == PanStepStatus.in_progress
        assert step.note == "Still waiting"

    async def test_prefills_the_form_from_the_stored_step(
        self,
        backoffice_client: httpx.AsyncClient,
        save_fixture: SaveFixture,
        organization: Organization,
    ) -> None:
        steps = pan_transfer.annotate(
            _advance_to("stripe_copy"), "stripe_copy", note="Chasing Stripe"
        )
        migration = await _create_migration(
            save_fixture,
            organization,
            step=MerchantMigrationStep.copy_cards,
            steps=steps,
        )

        response = await backoffice_client.get(
            f"/merchant-migrations/{migration.id}/steps/stripe_copy/annotate"
        )

        assert response.status_code == 200
        assert "Chasing Stripe" in response.text
