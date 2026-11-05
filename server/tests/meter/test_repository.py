import uuid
from decimal import Decimal

import pytest

from polar.enums import SubscriptionRecurringInterval
from polar.kit.utils import utc_now
from polar.meter.repository import MeterRepository
from polar.models import Catalog, Customer, Meter, Organization
from polar.models.catalog import CatalogStatus
from polar.postgres import AsyncSession
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_meter,
    create_product,
)


@pytest.fixture
async def meter_versions(
    save_fixture: SaveFixture, organization: Organization
) -> tuple[Meter, Meter, Meter]:
    """A meter's previous version, its current version, and a draft's version."""
    live = Catalog(organization=organization, status=CatalogStatus.live)
    draft = Catalog(organization=organization, status=CatalogStatus.draft)
    await save_fixture(live)
    await save_fixture(draft)
    return (
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="tool-calls",
            is_current=False,
        ),
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="tool-calls",
            catalog=live,
        ),
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            external_id="tool-calls",
            is_current=False,
            catalog=draft,
        ),
    )


@pytest.mark.anyio
class TestGetActiveStatement:
    async def test_skips_draft_archived_and_deleted_meters(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        meter_versions: tuple[Meter, Meter, Meter],
    ) -> None:
        previous, current, _ = meter_versions
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            archived_at=utc_now(),
        )
        await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            deleted_at=utc_now(),
        )

        repository = MeterRepository.from_session(session)
        meters = await repository.get_all(repository.get_active_statement())

        assert {meter.id for meter in meters} == {previous.id, current.id}


@pytest.mark.anyio
class TestGetByExternalIdAndOrganization:
    async def test_returns_the_current_version(
        self,
        session: AsyncSession,
        organization: Organization,
        meter_versions: tuple[Meter, Meter, Meter],
    ) -> None:
        _, current, _ = meter_versions

        meter = await MeterRepository.from_session(
            session
        ).get_by_external_id_and_organization("tool-calls", organization.id)

        assert meter is not None
        assert meter.id == current.id


@pytest.mark.anyio
class TestGetAllByExternalIds:
    async def test_returns_the_current_version(
        self,
        session: AsyncSession,
        organization: Organization,
        meter_versions: tuple[Meter, Meter, Meter],
    ) -> None:
        _, current, _ = meter_versions

        meters = await MeterRepository.from_session(session).get_all_by_external_ids(
            organization.id, ["tool-calls"]
        )

        assert [meter.id for meter in meters] == [current.id]


@pytest.mark.anyio
class TestGetBilledByExternalId:
    async def test_returns_the_version_the_customer_is_billed_on(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter_versions: tuple[Meter, Meter, Meter],
    ) -> None:
        previous, _, _ = meter_versions
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[(previous, Decimal(100), None, "usd")],
        )
        await create_active_subscription(
            save_fixture, product=product, customer=customer
        )

        meter = await MeterRepository.from_session(session).get_billed_by_external_id(
            organization.id, "tool-calls", customer.id
        )

        assert meter is not None
        assert meter.id == previous.id

    async def test_falls_back_to_the_current_version(
        self,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        meter_versions: tuple[Meter, Meter, Meter],
    ) -> None:
        _, current, _ = meter_versions

        meter = await MeterRepository.from_session(session).get_billed_by_external_id(
            organization.id, "tool-calls", customer.id
        )

        assert meter is not None
        assert meter.id == current.id
