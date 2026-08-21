from collections import Counter
from collections.abc import Sequence
from time import monotonic, sleep
from typing import Any, cast
from uuid import UUID

import pytest
import typer
from pytest_mock import MockerFixture
from sqlalchemy import delete, func, select
from sqlalchemy import event as sqlalchemy_event
from sqlalchemy.ext.asyncio import AsyncSession as SQLAlchemyAsyncSession
from typer.testing import CliRunner

from polar.event.repository import EventRepository
from polar.integrations.tinybird.client import client as tinybird_client
from polar.integrations.tinybird.service import DATASOURCE_EVENTS
from polar.kit.db.postgres import AsyncSession
from polar.models import (
    Benefit,
    Checkout,
    CheckoutLink,
    CheckoutLinkProduct,
    Customer,
    CustomerSeat,
    Discount,
    Dispute,
    Event,
    File,
    Member,
    Meter,
    MeterEvent,
    Order,
    Organization,
    Payment,
    Product,
    ProductBenefit,
    ProductPrice,
    SeatStatus,
    Subscription,
    SupportCase,
    UserOrganization,
)
from polar.models.subscription import SubscriptionStatus
from polar.redis import Redis
from scripts.seed_polar_for_polar import BENEFITS as POLAR_SELF_BENEFITS
from scripts.seed_polar_for_polar import PRODUCTS as POLAR_SELF_PRODUCTS
from scripts.seeds_load import (
    EXPECTED_ORGANIZATION_SLUGS,
    SIMPLE_COMPLEMENT_EVENT_NAMESPACE,
    SIMPLE_COMPLEMENT_EVENT_PREFIX,
    _delete_simple_complement_tinybird_events,
    cli,
    create_seed_data,
    create_simple_complement_seed_data,
    create_simple_seed_data,
    create_single_org_seed,
)


@pytest.mark.parametrize("phase", ["simple", "simple-complement"])
def test_new_org_rejects_explicit_non_all_phase(phase: str) -> None:
    result = CliRunner().invoke(cli, ["--new-org", "extra-org", "--phase", phase])

    assert result.exit_code == 2
    assert result.exception is not None
    error = result.exception.__context__
    assert isinstance(error, typer.BadParameter)
    assert str(error) == "--new-org cannot be combined with --phase"


@pytest.mark.asyncio
class TestSeedsLoad:
    async def test_single_organization_seed_compatibility(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
    ) -> None:
        ingested_event_ids: list[UUID] = []

        async def track_ingestion(
            events: Sequence[Event], _ancestors_by_event: dict[UUID, list[str]]
        ) -> None:
            ingested_event_ids.extend(event.id for event in events)

        mocker.patch(
            "scripts.seeds_load.tinybird_ingest_events", side_effect=track_ingestion
        )

        await create_single_org_seed(session, redis, "extra-org")

        organization = await session.scalar(
            select(Organization).where(Organization.slug == "extra-org")
        )
        assert organization is not None
        assert (
            await session.scalar(
                select(func.count(Product.id)).where(
                    Product.organization_id == organization.id
                )
            )
            == 5
        )
        customer_count = await session.scalar(
            select(func.count(Customer.id)).where(
                Customer.organization_id == organization.id
            )
        )
        assert customer_count is not None
        assert 5 <= customer_count <= 10
        postgres_event_ids = (
            (
                await session.execute(
                    select(Event.id).where(Event.organization_id == organization.id)
                )
            )
            .scalars()
            .all()
        )
        assert Counter(ingested_event_ids) == Counter(postgres_event_ids)

    async def test_simple_complement_seed_cleanup_waits_for_tinybird_job(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch("scripts.seeds_load.settings.TINYBIRD_API_TOKEN", "token")
        delete_mock = mocker.patch.object(
            tinybird_client,
            "delete",
            return_value={"job_id": "seed-cleanup"},
        )
        get_job_mock = mocker.patch.object(
            tinybird_client,
            "get_job",
            side_effect=[
                {"status": "working"},
                {"status": "done", "rows_affected": 12},
            ],
        )
        sleep_mock = mocker.patch("scripts.seeds_load.asyncio.sleep")

        deleted = await _delete_simple_complement_tinybird_events()

        assert deleted == 12
        delete_mock.assert_awaited_once_with(
            DATASOURCE_EVENTS,
            f"startsWith(external_id, '{SIMPLE_COMPLEMENT_EVENT_NAMESPACE}')",
        )
        assert get_job_mock.await_count == 2
        sleep_mock.assert_awaited_once_with(0.25)

    async def test_simple_seed_query_budget_and_fixtures(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
    ) -> None:
        ingest_events_mock = mocker.patch("scripts.seeds_load.tinybird_ingest_events")
        delete_events_mock = mocker.patch(
            "scripts.seeds_load._delete_simple_complement_tinybird_events"
        )
        sql_count = 0

        def count_queries(*args: Any) -> None:
            nonlocal sql_count
            sql_count += 1
            sleep(0.075)

        bind = session.sync_session.bind
        assert bind is not None
        sqlalchemy_event.listen(bind, "before_cursor_execute", count_queries)
        started_at = monotonic()
        try:
            created = await create_simple_seed_data(session, redis)
        finally:
            sqlalchemy_event.remove(bind, "before_cursor_execute", count_queries)
        elapsed = monotonic() - started_at

        assert created is True
        assert sql_count <= 650, sql_count
        assert elapsed <= 60, elapsed
        ingest_events_mock.assert_not_awaited()
        delete_events_mock.assert_not_awaited()

        organizations = (await session.execute(select(Organization))).scalars().all()
        assert {organization.slug for organization in organizations} == (
            EXPECTED_ORGANIZATION_SLUGS
        )
        assert all(
            organization.account_id is not None for organization in organizations
        )
        assert len({organization.account_id for organization in organizations}) == len(
            EXPECTED_ORGANIZATION_SLUGS
        )
        assert all(
            organization.payout_account_id is not None for organization in organizations
        )
        assert await session.scalar(select(func.count(UserOrganization.user_id))) == 9
        expected_product_count = 30 + len(POLAR_SELF_PRODUCTS)
        assert await session.scalar(select(func.count(Product.id))) == (
            expected_product_count
        )
        assert await session.scalar(select(func.count(ProductPrice.id))) == (
            expected_product_count
        )
        assert await session.scalar(select(func.count(Benefit.id))) == 11
        assert await session.scalar(select(func.count(File.id))) == 1
        assert await session.scalar(select(func.count(Meter.id))) == 2
        assert await session.scalar(select(func.count(Discount.id))) == 8
        assert await session.scalar(select(func.count(CheckoutLink.id))) == 9
        assert (await session.scalar(select(func.count(ProductBenefit.id))) or 0) > 0
        assert (
            await session.scalar(select(func.count(CheckoutLinkProduct.id))) or 0
        ) > 0
        assert (await session.scalar(select(func.count(Customer.id))) or 0) > 0
        assert (await session.scalar(select(func.count(Subscription.id))) or 0) > 0
        assert (await session.scalar(select(func.count(Member.id))) or 0) > 0
        assert await session.scalar(select(func.count(CustomerSeat.id))) == 10
        assert (
            await session.scalar(
                select(func.count(CustomerSeat.id)).where(
                    CustomerSeat.status == SeatStatus.claimed
                )
            )
            == 4
        )
        assert (
            await session.scalar(
                select(func.count(CustomerSeat.id)).where(
                    CustomerSeat.status == SeatStatus.pending
                )
            )
            == 6
        )

        acme = next(
            organization
            for organization in organizations
            if organization.slug == "acme-corp"
        )
        acme_statuses = set(
            (
                await session.execute(
                    select(Subscription.status).where(
                        Subscription.organization_id == acme.id
                    )
                )
            )
            .scalars()
            .all()
        )
        assert {SubscriptionStatus.active, SubscriptionStatus.trialing}.issubset(
            acme_statuses
        )

        polar = next(
            organization
            for organization in organizations
            if organization.slug == "polar"
        )
        polar_billing_customer_external_ids = set(
            (
                await session.execute(
                    select(Customer.external_id).where(
                        Customer.organization_id == polar.id,
                        Customer.external_id.is_not(None),
                    )
                )
            )
            .scalars()
            .all()
        )
        assert polar_billing_customer_external_ids == {
            str(organization.id)
            for organization in organizations
            if organization.slug != "polar"
        }
        polar_benefit_metadata: dict[str, dict[str, Any]] = {
            description: metadata
            for description, metadata in (
                await session.execute(
                    select(Benefit.description, Benefit.user_metadata).where(
                        Benefit.organization_id == polar.id
                    )
                )
            ).all()
        }
        assert polar_benefit_metadata == {
            str(benefit["description"]): benefit["metadata"]
            for benefit in POLAR_SELF_BENEFITS
        }

        assert await session.scalar(select(func.count(Event.id))) == 0
        assert await session.scalar(select(func.count(Checkout.id))) == 0
        assert await session.scalar(select(func.count(SupportCase.id))) == 0
        assert await session.scalar(select(func.count(Order.id))) == 0
        assert await session.scalar(select(func.count(Payment.id))) == 0
        assert await session.scalar(select(func.count(Dispute.id))) == 0
        assert (
            await session.scalar(
                select(func.count(Customer.id)).where(
                    Customer.email.like("compass_%@acme-corp.com")
                )
            )
            == 0
        )
        assert await create_simple_seed_data(session, redis) is False

    async def test_simple_complement_seed_retries_without_event_duplicates(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
    ) -> None:
        assert session.bind is not None
        phase_session = SQLAlchemyAsyncSession(
            bind=session.bind,
            expire_on_commit=False,
            join_transaction_mode="create_savepoint",
        )
        session = cast(AsyncSession, phase_session)
        await create_simple_seed_data(session, redis)
        cleanup_mock = mocker.patch(
            "scripts.seeds_load._delete_simple_complement_tinybird_events",
            return_value=0,
        )
        first_attempt_events: dict[str, UUID] = {}
        ingest_attempt = 0

        async def fail_during_ingestion(
            events: Sequence[Event], _ancestors_by_event: dict[UUID, list[str]]
        ) -> None:
            nonlocal ingest_attempt
            ingest_attempt += 1
            if ingest_attempt == 2:
                raise RuntimeError("Tinybird unavailable")
            first_attempt_events.update(
                {
                    event.external_id: event.id
                    for event in events
                    if event.external_id is not None
                }
            )

        ingest_events_mock = mocker.patch(
            "scripts.seeds_load.tinybird_ingest_events",
            side_effect=fail_during_ingestion,
        )
        with pytest.raises(RuntimeError, match="Tinybird unavailable"):
            await create_simple_complement_seed_data(session)

        assert first_attempt_events
        assert (
            await session.scalar(
                select(func.count(Event.id)).where(
                    Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
                )
            )
            == 0
        )
        assert (
            await session.scalar(
                select(func.count(Customer.id)).where(
                    Customer.email.like("compass_%@acme-corp.com")
                )
            )
            == 0
        )

        successful_ingestion: dict[str, UUID] = {}
        successful_external_ids: list[str] = []

        async def record_ingestion(
            events: Sequence[Event], _ancestors_by_event: dict[UUID, list[str]]
        ) -> None:
            successful_external_ids.extend(
                event.external_id for event in events if event.external_id is not None
            )
            successful_ingestion.update(
                {
                    event.external_id: event.id
                    for event in events
                    if event.external_id is not None
                }
            )

        ingest_events_mock.reset_mock(side_effect=True)
        ingest_events_mock.side_effect = record_ingestion
        assert await create_simple_complement_seed_data(session) is True

        event_rows = (
            await session.execute(
                select(Event.external_id, Event.id).where(
                    Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
                )
            )
        ).all()
        postgres_events: dict[str, UUID] = {
            external_id: event_id
            for external_id, event_id in event_rows
            if external_id is not None
        }
        assert postgres_events
        assert successful_ingestion == postgres_events
        assert Counter(successful_external_ids) == Counter(postgres_events.keys())
        assert first_attempt_events.items() <= successful_ingestion.items()
        assert all(
            len(call.args[0]) <= 2500 for call in ingest_events_mock.await_args_list
        )
        assert cleanup_mock.await_count == 2
        assert (
            await session.scalar(
                select(func.count(Customer.id)).where(
                    Customer.email.like("compass_%@acme-corp.com")
                )
            )
            == 18
        )
        assert await session.scalar(select(func.count(Checkout.id))) == 40
        assert (await session.scalar(select(func.count(SupportCase.id))) or 0) > 0
        assert (await session.scalar(select(func.count(Order.id))) or 0) > 0
        assert (await session.scalar(select(func.count(Payment.id))) or 0) > 0
        assert (await session.scalar(select(func.count(Dispute.id))) or 0) > 0
        assert (await session.scalar(select(func.count(MeterEvent.event_id))) or 0) > 0

        successful_call_count = ingest_events_mock.await_count
        event_count = len(postgres_events)
        assert await create_simple_complement_seed_data(session) is False
        assert ingest_events_mock.await_count == successful_call_count
        assert (
            await session.scalar(
                select(func.count(Event.id)).where(
                    Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
                )
            )
            == event_count
        )
        await phase_session.close()

    async def test_simple_complement_seed_requires_simple_seed(
        self, session: AsyncSession
    ) -> None:
        with pytest.raises(RuntimeError, match="requires the simple seed"):
            await create_simple_complement_seed_data(session)

    async def test_create_seed_data_default_all_compatibility(
        self,
        session: AsyncSession,
        redis: Redis,
        mocker: MockerFixture,
        capsys: pytest.CaptureFixture[str],
    ) -> None:
        sql_count = 0
        event_insert_count = 0
        history_insert_batch_count = 0
        ingested_event_ids: list[UUID] = []
        original_insert_batch = EventRepository.insert_batch

        async def track_ingestion(
            events: Sequence[Event], _ancestors_by_event: dict[UUID, list[str]]
        ) -> None:
            ingested_event_ids.extend(event.id for event in events)

        async def track_insert_batch(
            repository: EventRepository,
            events: Sequence[dict[str, Any]],
            *,
            render_nulls: bool = False,
        ) -> tuple[Sequence[UUID], int]:
            nonlocal history_insert_batch_count
            if any(
                str(event.get("external_id", "")).startswith(
                    SIMPLE_COMPLEMENT_EVENT_PREFIX
                )
                for event in events
            ):
                history_insert_batch_count += 1
            return await original_insert_batch(
                repository, events, render_nulls=render_nulls
            )

        def count_queries(*args: Any) -> None:
            nonlocal sql_count, event_insert_count
            sql_count += 1
            if args[2].startswith("INSERT INTO events"):
                event_insert_count += 1

        mocker.patch(
            "scripts.seeds_load._delete_simple_complement_tinybird_events",
            return_value=0,
        )
        mocker.patch(
            "scripts.seeds_load.tinybird_ingest_events", side_effect=track_ingestion
        )
        mocker.patch.object(EventRepository, "insert_batch", track_insert_batch)
        bind = session.sync_session.bind
        assert bind is not None
        sqlalchemy_event.listen(bind, "before_cursor_execute", count_queries)
        try:
            await create_seed_data(session, redis)
        finally:
            sqlalchemy_event.remove(bind, "before_cursor_execute", count_queries)

        postgres_event_ids = (
            (
                await session.execute(
                    select(Event.id).where(
                        Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
                    )
                )
            )
            .scalars()
            .all()
        )
        assert Counter(ingested_event_ids) == Counter(postgres_event_ids)
        assert history_insert_batch_count <= 7
        assert event_insert_count <= history_insert_batch_count * 2
        assert sql_count <= 1800, sql_count
        output = capsys.readouterr().out
        assert "seed.phase.simple status=pending" in output
        assert "seed.phase.simple status=success" in output
        assert "seed.phase.simple_complement status=pending" in output
        assert "seed.phase.simple_complement status=success" in output
        assert "seed.phase.all status=success" in output

        with pytest.raises(typer.Exit) as exception_info:
            await create_seed_data(session, redis)
        assert exception_info.value.exit_code == 2

        await session.execute(
            delete(Event).where(
                Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
            )
        )
        await session.commit()

        with pytest.raises(typer.Exit) as legacy_exception_info:
            await create_seed_data(session, redis)
        assert legacy_exception_info.value.exit_code == 2
        assert (
            await session.scalar(
                select(func.count(Event.id)).where(
                    Event.external_id.startswith(SIMPLE_COMPLEMENT_EVENT_PREFIX)
                )
            )
            == 0
        )
