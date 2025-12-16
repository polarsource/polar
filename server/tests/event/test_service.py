import uuid
from datetime import timedelta
from typing import Any
from unittest.mock import AsyncMock
from zoneinfo import ZoneInfo

import pytest
from pydantic import ValidationError
from pytest_mock import MockerFixture

from polar.auth.models import AuthSubject, is_user
from polar.event.repository import EventRepository
from polar.event.schemas import (
    EventCreateCustomer,
    EventCreateExternalCustomer,
    EventsIngest,
)
from polar.event.service import event as event_service
from polar.event.sorting import EventNamesSortProperty
from polar.event.system import SystemEvent
from polar.event_type.repository import EventTypeRepository
from polar.exceptions import PolarRequestValidationError
from polar.kit.pagination import PaginationParams
from polar.kit.time_queries import TimeInterval
from polar.kit.utils import utc_now
from polar.meter.aggregation import AggregationFunction, PropertyAggregation
from polar.meter.filter import Filter, FilterClause, FilterConjunction, FilterOperator
from polar.models import (
    Customer,
    CustomerMeter,
    EventType,
    Meter,
    Organization,
    Product,
    User,
    UserOrganization,
)
from polar.models.checkout import CheckoutStatus
from polar.models.discount import DiscountDuration, DiscountType
from polar.models.event import EventSource
from polar.models.order import OrderStatus
from polar.models.subscription import CustomerCancellationReason
from polar.order.service import order as order_service
from polar.postgres import AsyncSession
from polar.subscription.service import subscription as subscription_service
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_checkout,
    create_customer,
    create_discount,
    create_event,
    create_order,
    create_payment,
)


@pytest.fixture
def enqueue_events_mock(mocker: MockerFixture) -> AsyncMock:
    return mocker.patch("polar.event.service.enqueue_events")


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth
    async def test_not_organization_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        await create_event(save_fixture, organization=organization)

        events, count = await event_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(events) == 0
        assert count == 0

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event_type_repository = EventTypeRepository.from_session(session)
        event_type = await event_type_repository.get_or_create(
            "TEST_EVENT", organization.id
        )

        await create_event(
            save_fixture, organization=organization, event_type=event_type
        )

        events, count = await event_service.list(
            session, auth_subject, pagination=PaginationParams(1, 10)
        )

        assert len(events) == 1
        assert count == 1
        assert events[0].label == event_type.label

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
            metadata={"tokens": 10},
        )
        event2 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
            metadata={"tokens": 100},
        )

        events, count = await event_service.list(
            session,
            auth_subject,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="tokens",
                        operator=FilterOperator.gt,
                        value=50,
                    )
                ],
            ),
            pagination=PaginationParams(1, 10),
        )

        assert len(events) == 1
        assert count == 1
        assert events[0].id == event2.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_after_before_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() - timedelta(days=1),
        )
        event2 = await create_event(
            save_fixture,
            organization=organization,
            timestamp=utc_now() + timedelta(days=1),
        )

        # Start timestamp
        events, count = await event_service.list(
            session,
            auth_subject,
            start_timestamp=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event2.id

        # End timestamp
        events, count = await event_service.list(
            session,
            auth_subject,
            end_timestamp=utc_now(),
            pagination=PaginationParams(1, 10),
        )
        assert len(events) == 1
        assert count == 1
        assert events[0].id == event1.id

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_metadata_filter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event1 = await create_event(
            save_fixture, organization=organization, metadata={"foo": "bar"}
        )
        await create_event(
            save_fixture, organization=organization, metadata={"foo": "baz"}
        )
        await create_event(
            save_fixture, organization=organization, metadata={"hello": "world"}
        )

        events, count = await event_service.list(
            session,
            auth_subject,
            metadata={"foo": ["bar"]},
            pagination=PaginationParams(1, 10),
        )

        assert len(events) == 1
        assert count == 1

        assert events[0].id == event1.id


@pytest.mark.asyncio
class TestGet:
    @pytest.mark.auth
    async def test_not_existing(
        self, session: AsyncSession, auth_subject: AuthSubject[User]
    ) -> None:
        result = await event_service.get(session, auth_subject, uuid.uuid4())

        assert result is None

    @pytest.mark.auth
    async def test_not_organization_member(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)

        result = await event_service.get(session, auth_subject, event.id)

        assert result is None

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        event = await create_event(save_fixture, organization=organization)

        result = await event_service.get(session, auth_subject, event.id)

        assert result is not None
        assert result.id == event.id


@pytest.mark.asyncio
class TestListNames:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_basic(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        for i in range(5):
            await create_event(save_fixture, organization=organization, name="event_1")
        for i in range(3):
            await create_event(
                save_fixture,
                organization=organization,
                name="event_2",
                source=EventSource.system,
            )

        event_names, count = await event_service.list_names(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            sorting=[(EventNamesSortProperty.event_name, False)],
        )

        assert len(event_names) == 2
        event_1_name = event_names[0]
        assert event_1_name.name == "event_1"
        assert event_1_name.occurrences == 5
        assert event_1_name.source == EventSource.user

        event_2_name = event_names[1]
        assert event_2_name.name == "event_2"
        assert event_2_name.occurrences == 3
        assert event_2_name.source == EventSource.system

        assert count == 2


@pytest.mark.asyncio
class TestIngest:
    @pytest.mark.auth
    async def test_invalid_future_timestamp(self, organization: Organization) -> None:
        with pytest.raises(ValidationError):
            EventsIngest(
                events=[
                    EventCreateExternalCustomer(
                        name="test",
                        timestamp=utc_now() + timedelta(days=1),
                        external_customer_id="test",
                        organization_id=organization.id,
                    ),
                    EventCreateExternalCustomer(
                        name="test",
                        timestamp=utc_now() - timedelta(days=1),
                        external_customer_id="test",
                        organization_id=organization.id,
                    ),
                ]
            )

    @pytest.mark.auth
    async def test_invalid_user_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization_second.id,
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 2

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_invalid_organization(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
        organization: Organization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                ),
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 1

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_invalid_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        organization: Organization,
        organization_second: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        customer_organization_second = await create_customer(
            save_fixture, organization=organization_second
        )

        ingest = EventsIngest(
            events=[
                EventCreateCustomer(
                    name="test",
                    customer_id=uuid.uuid4(),
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
                EventCreateCustomer(
                    name="test",
                    customer_id=customer_organization_second.id,
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
                EventCreateCustomer(
                    name="test",
                    customer_id=customer.id,
                    organization_id=organization.id if is_user(auth_subject) else None,
                ),
            ]
        )

        with pytest.raises(PolarRequestValidationError) as e:
            await event_service.ingest(session, auth_subject, ingest)

        errors = e.value.errors()
        assert len(errors) == 2

    @pytest.mark.parametrize("count", [0, 1, 500])
    @pytest.mark.auth
    async def test_valid_user(
        self,
        count: int,
        enqueue_events_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    organization_id=organization.id,
                )
                for _ in range(count)
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(organization.id)
        assert len(events) == count

        for event in events:
            assert event.source == EventSource.user

        enqueue_events_mock.assert_called_once()
        assert set(enqueue_events_mock.call_args[0]) == {event.id for event in events}

    @pytest.mark.parametrize("count", [0, 1, 500])
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_valid_organization(
        self,
        count: int,
        enqueue_events_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                )
                for _ in range(count)
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == count

        for event in events:
            assert event.source == EventSource.user

        enqueue_events_mock.assert_called_once()
        assert set(enqueue_events_mock.call_args[0]) == {event.id for event in events}

    @pytest.mark.parametrize(
        "metadata",
        [
            {
                "_cost": {
                    "amount": "0.000000000001",
                    "currency": "usd",
                }
            }
        ],
    )
    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_valid_metadata(
        self,
        metadata: Any,
        enqueue_events_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="test",
                    external_customer_id="test",
                    metadata=metadata,
                )
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == 1

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_event_type_lookup(
        self,
        enqueue_events_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        event_type_repository = EventTypeRepository.from_session(session)
        event_repository = EventRepository.from_session(session)

        ingest_first = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="api.request",
                    external_customer_id="test",
                )
            ]
        )

        await event_service.ingest(session, auth_subject, ingest_first)

        event_type = await event_type_repository.get_by_name_and_organization(
            "api.request", auth_subject.subject.id
        )
        assert event_type is not None
        assert event_type.name == "api.request"
        assert event_type.label == "api.request"

        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == 1
        assert events[0].event_type_id == event_type.id

        ingest_second = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="api.request",
                    external_customer_id="test2",
                )
            ]
        )

        await event_service.ingest(session, auth_subject, ingest_second)

        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == 2
        assert events[0].event_type_id == event_type.id
        assert events[1].event_type_id == event_type.id

        event_type_after = await event_type_repository.get_by_name_and_organization(
            "api.request", auth_subject.subject.id
        )
        assert event_type_after is not None
        assert event_type_after.id == event_type.id

    @pytest.mark.auth(AuthSubjectFixture(subject="organization"))
    async def test_parent_child_same_batch(
        self,
        enqueue_events_mock: AsyncMock,
        session: AsyncSession,
        auth_subject: AuthSubject[Organization],
    ) -> None:
        event_repository = EventRepository.from_session(session)

        ingest = EventsIngest(
            events=[
                EventCreateExternalCustomer(
                    name="support_request",
                    external_customer_id="test-customer-123",
                    external_id="parent-event-123",
                ),
                EventCreateExternalCustomer(
                    name="email_sent",
                    external_customer_id="test-customer-123",
                    parent_id="parent-event-123",
                ),
                EventCreateExternalCustomer(
                    name="support_request_completed",
                    external_customer_id="test-customer-123",
                    parent_id="parent-event-123",
                ),
            ]
        )

        await event_service.ingest(session, auth_subject, ingest)

        events = await event_repository.get_all_by_organization(auth_subject.subject.id)
        assert len(events) == 3

        parent = next(e for e in events if e.name == "support_request")
        email_child = next(e for e in events if e.name == "email_sent")
        completed_child = next(
            e for e in events if e.name == "support_request_completed"
        )

        assert parent.parent_id is None
        assert parent.root_id == parent.id
        assert parent.external_id == "parent-event-123"

        assert email_child.parent_id == parent.id
        assert email_child.root_id == parent.id

        assert completed_child.parent_id == parent.id
        assert completed_child.root_id == parent.id

        enqueue_events_mock.assert_called_once()
        assert set(enqueue_events_mock.call_args[0]) == {
            parent.id,
            email_child.id,
            completed_child.id,
        }


@pytest.mark.asyncio
class TestListWithAggregateCosts:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_aggregate_costs(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        root_with_cost = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )
        child1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root_with_cost.id,
            metadata={"_cost": {"amount": 5, "currency": "usd"}},
        )
        child2 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root_with_cost.id,
            metadata={"_cost": {"amount": 3, "currency": "usd"}},
        )
        root_without_cost = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            metadata={"conversationId": "123"},
        )
        child3 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root_without_cost.id,
            metadata={"_cost": {"amount": 7, "currency": "usd"}},
        )

        events_without_agg, _ = await event_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            aggregate_fields=[],
        )

        root1_no_agg = next(e for e in events_without_agg if e.id == root_with_cost.id)
        child1_no_agg = next(e for e in events_without_agg if e.id == child1.id)
        child2_no_agg = next(e for e in events_without_agg if e.id == child2.id)
        root2_no_agg = next(
            e for e in events_without_agg if e.id == root_without_cost.id
        )

        assert root1_no_agg.child_count == 2  # type: ignore[attr-defined]
        assert root1_no_agg.user_metadata["_cost"]["amount"] == 10
        assert child1_no_agg.child_count == 0  # type: ignore[attr-defined]
        assert child1_no_agg.user_metadata["_cost"]["amount"] == 5
        assert child2_no_agg.child_count == 0  # type: ignore[attr-defined]
        assert child2_no_agg.user_metadata["_cost"]["amount"] == 3
        assert root2_no_agg.child_count == 1  # type: ignore[attr-defined]
        assert "_cost" not in root2_no_agg.user_metadata

        events_with_agg, _ = await event_service.list(
            session,
            auth_subject,
            pagination=PaginationParams(1, 10),
            aggregate_fields=["_cost.amount"],
        )

        root1_agg = next(e for e in events_with_agg if e.id == root_with_cost.id)
        child1_agg = next(e for e in events_with_agg if e.id == child1.id)
        child2_agg = next(e for e in events_with_agg if e.id == child2.id)
        root2_agg = next(e for e in events_with_agg if e.id == root_without_cost.id)

        # root1 already had _cost with currency, so it's preserved
        assert root1_agg.child_count == 2  # type: ignore[attr-defined]
        assert root1_agg.user_metadata["_cost"]["amount"] == 18
        assert root1_agg.user_metadata["_cost"]["currency"] == "usd"
        assert child1_agg.child_count == 0  # type: ignore[attr-defined]
        assert child1_agg.user_metadata["_cost"]["amount"] == 5
        assert child2_agg.child_count == 0  # type: ignore[attr-defined]
        assert child2_agg.user_metadata["_cost"]["amount"] == 3

        # root2 didn't have _cost originally, so only aggregated amount is set
        # Currency defaults to "usd" when not present in parent
        assert root2_agg.child_count == 1  # type: ignore[attr-defined]
        assert "_cost" in root2_agg.user_metadata
        assert root2_agg.user_metadata["_cost"]["amount"] == 7
        assert root2_agg.user_metadata["_cost"]["currency"] == "usd"
        assert root2_agg.user_metadata["conversationId"] == "123"


@pytest.mark.asyncio
class TestListStatisticsTimeseries:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_hierarchy_stats_timeseries(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        request_event_type = EventType(
            name="request",
            label="API Request",
            organization=organization,
        )
        await save_fixture(request_event_type)

        now = utc_now()
        today = now.replace(hour=12, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)
        two_days_ago = today - timedelta(days=2)

        root1_p0 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            timestamp=two_days_ago,
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )
        child1_p0 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root1_p0.id,
            timestamp=two_days_ago,
            metadata={"_cost": {"amount": 5, "currency": "usd"}},
        )

        root2_p0 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            timestamp=two_days_ago,
            metadata={"_cost": {"amount": 20, "currency": "usd"}},
        )
        child2_p0 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root2_p0.id,
            timestamp=two_days_ago,
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )

        root1_p1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            timestamp=yesterday,
            metadata={"_cost": {"amount": 30, "currency": "usd"}},
        )
        child1_p1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root1_p1.id,
            timestamp=yesterday,
            metadata={"_cost": {"amount": 15, "currency": "usd"}},
        )

        root2_p1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            timestamp=yesterday,
            metadata={"_cost": {"amount": 40, "currency": "usd"}},
        )
        child2_p1 = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root2_p1.id,
            timestamp=yesterday,
            metadata={"_cost": {"amount": 20, "currency": "usd"}},
        )

        result = await event_service.list_statistics_timeseries(
            session,
            auth_subject,
            start_date=two_days_ago.date(),
            end_date=today.date(),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            aggregate_fields=("_cost.amount",),
        )

        p0_event1 = [root1_p0, child1_p0]
        p0_event2 = [root2_p0, child2_p0]
        p0_event1_cost = sum([e.user_metadata["_cost"]["amount"] for e in p0_event1])
        p0_event2_cost = sum([e.user_metadata["_cost"]["amount"] for e in p0_event2])
        p0_total_cost = p0_event1_cost + p0_event2_cost

        p1_event1 = [root1_p1, child1_p1]
        p1_event2 = [root2_p1, child2_p1]
        p1_event1_cost = sum([e.user_metadata["_cost"]["amount"] for e in p1_event1])
        p1_event2_cost = sum([e.user_metadata["_cost"]["amount"] for e in p1_event2])
        p1_total_cost = p1_event1_cost + p1_event2_cost

        all_costs = [p0_event1_cost, p0_event2_cost, p1_event1_cost, p1_event2_cost]
        total_cost = sum(all_costs)

        assert len(result.periods) == 3

        period_0_stats = result.periods[0].stats
        assert len(period_0_stats) == 1
        assert period_0_stats[0].name == "request"
        assert period_0_stats[0].occurrences == 2
        assert period_0_stats[0].customers == 1
        assert period_0_stats[0].totals["_cost_amount"] == p0_total_cost
        assert period_0_stats[0].averages["_cost_amount"] == p0_total_cost / 2
        assert float(period_0_stats[0].p10["_cost_amount"]) == pytest.approx(
            p0_event1_cost + 0.10 * (p0_event2_cost - p0_event1_cost)
        )
        assert float(period_0_stats[0].p90["_cost_amount"]) == pytest.approx(
            p0_event1_cost + 0.90 * (p0_event2_cost - p0_event1_cost)
        )
        assert float(period_0_stats[0].p99["_cost_amount"]) == pytest.approx(
            p0_event1_cost + 0.99 * (p0_event2_cost - p0_event1_cost)
        )

        period_1_stats = result.periods[1].stats
        assert len(period_1_stats) == 1
        assert period_1_stats[0].name == "request"
        assert period_1_stats[0].occurrences == 2
        assert period_1_stats[0].customers == 1
        assert period_1_stats[0].totals["_cost_amount"] == p1_total_cost
        assert period_1_stats[0].averages["_cost_amount"] == p1_total_cost / 2
        assert float(period_1_stats[0].p10["_cost_amount"]) == pytest.approx(
            p1_event1_cost + 0.10 * (p1_event2_cost - p1_event1_cost)
        )
        assert float(period_1_stats[0].p90["_cost_amount"]) == pytest.approx(
            p1_event1_cost + 0.90 * (p1_event2_cost - p1_event1_cost)
        )
        assert float(period_1_stats[0].p99["_cost_amount"]) == pytest.approx(
            p1_event1_cost + 0.99 * (p1_event2_cost - p1_event1_cost)
        )

        # Period 2 (today) should have the event type with zero values
        period_2_stats = result.periods[2].stats
        assert len(period_2_stats) == 1
        assert period_2_stats[0].name == "request"
        assert period_2_stats[0].occurrences == 0
        assert period_2_stats[0].customers == 0
        assert period_2_stats[0].totals["_cost_amount"] == 0
        assert period_2_stats[0].averages["_cost_amount"] == 0

        assert len(result.totals) == 1
        assert result.totals[0].occurrences == 4
        assert result.totals[0].customers == 1
        assert result.totals[0].totals["_cost_amount"] == total_cost
        assert result.totals[0].averages["_cost_amount"] == total_cost / 4
        sorted_costs = sorted(all_costs)
        assert float(result.totals[0].p10["_cost_amount"]) == pytest.approx(
            sorted_costs[0] + 0.10 * (sorted_costs[3] - sorted_costs[0])
        )
        assert float(result.totals[0].p90["_cost_amount"]) == pytest.approx(
            sorted_costs[0] + 0.90 * (sorted_costs[3] - sorted_costs[0])
        )
        assert float(result.totals[0].p99["_cost_amount"]) == pytest.approx(
            sorted_costs[0] + 0.99 * (sorted_costs[3] - sorted_costs[0])
        )

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_hierarchy_stats_multiple_customers(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        request_event_type = EventType(
            name="request",
            label="API Request",
            organization=organization,
        )
        await save_fixture(request_event_type)

        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )
        customer2 = await create_customer(
            save_fixture, organization=organization, email="customer2@example.com"
        )
        customer3 = await create_customer(
            save_fixture, organization=organization, email="customer3@example.com"
        )

        now = utc_now()
        today = now.replace(hour=12, minute=0, second=0, microsecond=0)
        yesterday = today - timedelta(days=1)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            name="request",
            timestamp=yesterday,
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            name="request",
            timestamp=yesterday,
            metadata={"_cost": {"amount": 20, "currency": "usd"}},
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer2,
            name="request",
            timestamp=yesterday,
            metadata={"_cost": {"amount": 30, "currency": "usd"}},
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer3,
            name="request",
            timestamp=today,
            metadata={"_cost": {"amount": 40, "currency": "usd"}},
        )

        result = await event_service.list_statistics_timeseries(
            session,
            auth_subject,
            start_date=yesterday.date(),
            end_date=today.date(),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            aggregate_fields=("_cost.amount",),
        )

        assert len(result.periods) == 2

        period_0_stats = result.periods[0].stats
        assert len(period_0_stats) == 1
        assert period_0_stats[0].name == "request"
        assert period_0_stats[0].occurrences == 3
        assert period_0_stats[0].customers == 2

        period_1_stats = result.periods[1].stats
        assert len(period_1_stats) == 1
        assert period_1_stats[0].name == "request"
        assert period_1_stats[0].occurrences == 1
        assert period_1_stats[0].customers == 1

        assert len(result.totals) == 1
        assert result.totals[0].occurrences == 4
        assert result.totals[0].customers == 3

    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_hierarchy_stats_external_customer_not_in_db(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
    ) -> None:
        """Test that external_customer_id events without a matching Customer record
        are counted as anonymous customers in the distinct count."""
        request_event_type = EventType(
            name="request",
            label="API Request",
            organization=organization,
        )
        await save_fixture(request_event_type)

        customer1 = await create_customer(
            save_fixture, organization=organization, email="customer1@example.com"
        )

        now = utc_now()
        today = now.replace(hour=12, minute=0, second=0, microsecond=0)

        await create_event(
            save_fixture,
            organization=organization,
            customer=customer1,
            name="request",
            timestamp=today,
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )
        await create_event(
            save_fixture,
            organization=organization,
            external_customer_id="unknown_external_customer",
            name="request",
            timestamp=today,
            metadata={"_cost": {"amount": 20, "currency": "usd"}},
        )

        result = await event_service.list_statistics_timeseries(
            session,
            auth_subject,
            start_date=today.date(),
            end_date=today.date(),
            timezone=ZoneInfo("UTC"),
            interval=TimeInterval.day,
            aggregate_fields=("_cost.amount",),
        )

        assert len(result.periods) == 1
        period_stats = result.periods[0].stats
        assert len(period_stats) == 1
        assert period_stats[0].occurrences == 2
        assert period_stats[0].customers == 2

        assert len(result.totals) == 1
        assert result.totals[0].occurrences == 2
        assert result.totals[0].customers == 2


@pytest.mark.asyncio
class TestAggregateFieldsDoNotPersist:
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_aggregate_fields_do_not_modify_database(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        auth_subject: AuthSubject[User],
        organization: Organization,
        user_organization: UserOrganization,
        customer: Customer,
    ) -> None:
        root = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="request",
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )
        child = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name="child",
            parent_id=root.id,
            metadata={"_cost": {"amount": 5, "currency": "usd"}},
        )

        # Store original values and IDs
        root_id = root.id
        child_id = child.id
        original_root_cost = root.user_metadata["_cost"]["amount"]
        original_child_cost = child.user_metadata["_cost"]["amount"]

        # Query with aggregate_fields multiple times
        for _ in range(3):
            events, _ = await event_service.list(
                session,
                auth_subject,
                pagination=PaginationParams(1, 10),
                aggregate_fields=["_cost.amount"],
            )
            await session.commit()

        # Fetch fresh from database to get latest values

        repo = EventRepository.from_session(session)
        root_after = await repo.get_by_id(root_id)
        child_after = await repo.get_by_id(child_id)

        # Verify database values haven't changed
        assert root_after is not None
        assert child_after is not None
        assert root_after.user_metadata["_cost"]["amount"] == original_root_cost
        assert child_after.user_metadata["_cost"]["amount"] == original_child_cost


@pytest.mark.asyncio
class TestIngested:
    async def test_basic(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
        customer_second: Customer,
    ) -> None:
        events = [
            await create_event(
                save_fixture,
                customer=customer,
                organization=customer.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                customer=customer,
                organization=customer.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                customer=customer_second,
                organization=customer_second.organization,
                source=EventSource.user,
            ),
            await create_event(
                save_fixture,
                external_customer_id="UNLINKED_EXTERNAL_CUSTOMER_ID",
                organization=organization,
                source=EventSource.user,
            ),
        ]

        await event_service.ingested(session, [event.id for event in events])

        assert customer.meters_dirtied_at is not None
        assert customer_second.meters_dirtied_at is not None

    async def test_auto_enable_revops_for_cost_events(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        assert organization.feature_settings.get("revops_enabled", False) is False

        event = await create_event(
            save_fixture,
            customer=customer,
            organization=organization,
            source=EventSource.user,
            metadata={"_cost": {"amount": 10, "currency": "usd"}},
        )

        await event_service.ingested(session, [event.id])

        await session.refresh(organization)
        assert organization.feature_settings.get("revops_enabled", False) is True

    async def test_no_auto_enable_revops_without_cost(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        assert organization.feature_settings.get("revops_enabled", False) is False

        event = await create_event(
            save_fixture,
            customer=customer,
            organization=organization,
            source=EventSource.user,
            metadata={"some_field": "some_value"},
        )

        await event_service.ingested(session, [event.id])

        await session.refresh(organization)
        assert organization.feature_settings.get("revops_enabled", False) is False

    async def test_activates_matching_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        meter = Meter(
            name="Test Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await save_fixture(meter)

        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            activated_at=None,
        )
        await save_fixture(customer_meter)

        assert customer_meter.activated_at is None

        event = await create_event(
            save_fixture,
            customer=customer,
            organization=organization,
            source=EventSource.user,
            metadata={"model": "lite", "tokens": 10},
        )

        await event_service.ingested(session, [event.id])

        await session.refresh(customer_meter)
        assert customer_meter.activated_at is not None

    async def test_does_not_activate_non_matching_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        meter = Meter(
            name="Test Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await save_fixture(meter)

        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            activated_at=None,
        )
        await save_fixture(customer_meter)

        assert customer_meter.activated_at is None

        event = await create_event(
            save_fixture,
            customer=customer,
            organization=organization,
            source=EventSource.user,
            metadata={"model": "pro", "tokens": 10},
        )

        await event_service.ingested(session, [event.id])

        await session.refresh(customer_meter)
        assert customer_meter.activated_at is None

    async def test_activates_matching_customer_meter_with_external_customer_id(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
    ) -> None:
        customer = await create_customer(
            save_fixture,
            organization=organization,
            external_id="ext-customer-123",
            email="external@example.com",
        )

        meter = Meter(
            name="Test Meter",
            organization=organization,
            filter=Filter(
                conjunction=FilterConjunction.and_,
                clauses=[
                    FilterClause(
                        property="model", operator=FilterOperator.eq, value="lite"
                    )
                ],
            ),
            aggregation=PropertyAggregation(
                func=AggregationFunction.sum, property="tokens"
            ),
        )
        await save_fixture(meter)

        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            activated_at=None,
        )
        await save_fixture(customer_meter)

        assert customer_meter.activated_at is None

        event = await create_event(
            save_fixture,
            external_customer_id="ext-customer-123",
            organization=organization,
            source=EventSource.user,
            metadata={"model": "lite", "tokens": 10},
        )

        await event_service.ingested(session, [event.id])

        await session.refresh(customer_meter)
        assert customer_meter.activated_at is not None


@pytest.mark.asyncio
class TestSystemEvents:
    @pytest.fixture
    def stripe_service_mock(self, mocker: Any) -> Any:
        mock = mocker.patch("polar.order.service.stripe_service")
        mock.create_tax_transaction.return_value = None
        return mock

    async def test_order_paid_one_time(
        self,
        stripe_service_mock: Any,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product_one_time: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        order = await create_order(
            save_fixture,
            product=product_one_time,
            customer=customer,
            status=OrderStatus.pending,
        )

        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        await order_service.handle_payment(session, order, payment)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.order_paid)
        assert len(events) == 1
        event = events[0]

        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["order_id"] == str(order.id)
        assert event.user_metadata["amount"] == order.total_amount
        assert event.user_metadata["currency"] == order.currency
        assert event.user_metadata["net_amount"] == order.net_amount
        assert event.user_metadata["tax_amount"] == order.tax_amount
        assert (
            event.user_metadata["applied_balance_amount"]
            == order.applied_balance_amount
        )
        assert event.user_metadata["discount_amount"] == order.discount_amount
        assert event.user_metadata["platform_fee"] == order.platform_fee_amount
        assert "subscription_id" not in event.user_metadata
        assert "subscription_type" not in event.user_metadata
        assert "discount_id" not in event.user_metadata

    async def test_order_paid_subscription(
        self,
        stripe_service_mock: Any,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            subscription=subscription,
            status=OrderStatus.pending,
        )

        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        await order_service.handle_payment(session, order, payment)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.order_paid)
        assert len(events) == 1
        event = events[0]

        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["recurring_interval"] == "month"
        assert event.user_metadata["recurring_interval_count"] == 1

    async def test_order_paid_with_discount(
        self,
        stripe_service_mock: Any,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        discount = await create_discount(
            save_fixture,
            type=DiscountType.fixed,
            amount=1000,
            currency="usd",
            duration=DiscountDuration.once,
            organization=organization,
        )

        order = await create_order(
            save_fixture,
            product=product,
            customer=customer,
            discount=discount,
            status=OrderStatus.pending,
        )

        payment = await create_payment(
            save_fixture,
            organization,
            processor_id="stripe_payment_123",
        )

        await order_service.handle_payment(session, order, payment)

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(SystemEvent.order_paid)
        assert len(events) == 1
        event = events[0]

        assert event.user_metadata["discount_id"] == str(discount.id)

    async def test_subscription_created(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
        organization: Organization,
    ) -> None:
        checkout = await create_checkout(
            save_fixture,
            products=[product],
            status=CheckoutStatus.confirmed,
            customer=customer,
        )

        subscription, _ = await subscription_service.create_or_update_from_checkout(
            session, checkout
        )

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_created
        )
        assert len(events) == 1
        event = events[0]

        assert event.customer_id == customer.id
        assert event.organization_id == organization.id
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["product_id"] == str(product.id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert event.user_metadata["recurring_interval"] == "month"
        assert event.user_metadata["recurring_interval_count"] == 1
        assert "started_at" in event.user_metadata

    async def test_subscription_canceled(
        self,
        session: AsyncSession,
        save_fixture: SaveFixture,
        product: Product,
        customer: Customer,
    ) -> None:
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        await subscription_service.cancel(
            session,
            subscription,
            customer_reason=CustomerCancellationReason.too_expensive,
            customer_comment="Too pricey for me",
        )

        event_repository = EventRepository.from_session(session)
        events = await event_repository.get_all_by_name(
            SystemEvent.subscription_canceled
        )
        assert len(events) == 1
        event = events[0]

        assert event.customer_id == customer.id
        assert event.user_metadata["subscription_id"] == str(subscription.id)
        assert event.user_metadata["amount"] == subscription.amount
        assert event.user_metadata["currency"] == subscription.currency
        assert (
            event.user_metadata["recurring_interval"]
            == subscription.recurring_interval.value
        )
        assert (
            event.user_metadata["recurring_interval_count"]
            == subscription.recurring_interval_count
        )
        assert event.user_metadata["customer_cancellation_reason"] == "too_expensive"
        assert (
            event.user_metadata["customer_cancellation_comment"] == "Too pricey for me"
        )
        assert "canceled_at" in event.user_metadata
        assert "ends_at" in event.user_metadata
