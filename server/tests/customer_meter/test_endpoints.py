import uuid
from datetime import timedelta
from decimal import Decimal

import pytest
from httpx import AsyncClient
from pytest_mock import MockerFixture
from sqlalchemy.exc import DBAPIError

from polar.customer_meter.repository import CustomerMeterRepository
from polar.enums import SubscriptionRecurringInterval
from polar.event.system import SystemEvent
from polar.kit.utils import utc_now
from polar.models import (
    BillingEntry,
    Customer,
    CustomerMeter,
    Event,
    Meter,
    OrderItem,
    Organization,
    User,
    UserOrganization,
)
from polar.models.billing_entry import BillingEntryDirection, BillingEntryType
from polar.models.event import EventSource
from polar.postgres import AsyncSession
from polar.version import V2027_01
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    create_active_subscription,
    create_event,
    create_meter,
    create_order,
    create_product,
    create_product_price_metered_unit,
)


@pytest.fixture
async def customer_meter_organization_second(
    save_fixture: SaveFixture,
    organization_second: Organization,
    customer_organization_second: Customer,
) -> CustomerMeter:
    meter = await create_meter(
        save_fixture,
        id=uuid.uuid4(),
        organization=organization_second,
    )
    customer_meter = CustomerMeter(
        customer=customer_organization_second,
        meter=meter,
        consumed_units=Decimal(0),
        credited_units=0,
        balance=Decimal(0),
    )
    await save_fixture(customer_meter)
    return customer_meter


@pytest.fixture
async def customer_meters_with_external_ids(
    save_fixture: SaveFixture, organization: Organization, customer: Customer
) -> tuple[CustomerMeter, CustomerMeter]:
    customer_meters: list[CustomerMeter] = []
    for external_id in ("tool_call", "tokens"):
        meter = await create_meter(
            save_fixture,
            id=uuid.uuid4(),
            organization=organization,
            external_id=external_id,
        )
        customer_meter = CustomerMeter(
            customer=customer,
            meter=meter,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter)
        customer_meters.append(customer_meter)
    return customer_meters[0], customer_meters[1]


@pytest.mark.anyio
class TestListCustomerMeters:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get("/v1/customer-meters/")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_does_not_see_other_organization_customer_meters(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meter_organization_second: CustomerMeter,
    ) -> None:
        response = await client.get("/v1/customer-meters/")

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 0

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_meter_id_2027_01(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meters_with_external_ids: tuple[CustomerMeter, CustomerMeter],
    ) -> None:
        tool_call, _ = customer_meters_with_external_ids

        response = await client.get(
            "/v1/customer-meters/", params={"external_meter_id": "tool_call"}
        )

        assert response.status_code == 200
        json = response.json()
        assert json["pagination"]["total_count"] == 1
        assert json["items"][0]["id"] == str(tool_call.id)


@pytest.mark.anyio
class TestGetCustomerMeter:
    async def test_anonymous(self, client: AsyncClient) -> None:
        response = await client.get(f"/v1/customer-meters/{uuid.uuid4()}")

        assert response.status_code == 401

    @pytest.mark.auth
    async def test_user_cannot_access_other_organization_customer_meter(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer_meter_organization_second: CustomerMeter,
    ) -> None:
        response = await client.get(
            f"/v1/customer-meters/{customer_meter_organization_second.id}"
        )

        assert response.status_code == 404


@pytest.mark.anyio
class TestCreditCustomerMeter:
    @pytest.mark.api_version(V2027_01)
    async def test_anonymous_2027_01(self, client: AsyncClient) -> None:
        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(uuid.uuid4()),
                "meter_id": str(uuid.uuid4()),
                "units": 100,
            },
        )

        assert response.status_code == 401

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_meter_from_other_accessible_organization(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user: User,
        user_organization: UserOrganization,
        organization_second: Organization,
        customer: Customer,
        customer_meter_organization_second: CustomerMeter,
    ) -> None:
        await save_fixture(
            UserOrganization(user=user, organization=organization_second)
        )

        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(customer_meter_organization_second.meter_id),
                "units": 100,
            },
        )

        assert response.status_code == 422
        assert response.json()["detail"][0]["loc"] == ["body", "meter_id"]

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth(
        AuthSubjectFixture(subject="user"),
        AuthSubjectFixture(subject="organization"),
    )
    async def test_valid(
        self,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 100,
                "rollover": True,
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["source"] == "system"
        assert json["name"] == SystemEvent.meter_credited
        assert json["customer_id"] == str(customer.id)
        assert json["customer"]["id"] == str(customer.id)
        assert json["metadata"] == {
            "meter_id": str(meter.id),
            "units": 100,
            "rollover": True,
            "reason": "manual",
        }

        repository = CustomerMeterRepository.from_session(session)
        customer_meter = await repository.get_by_customer_and_meter(
            customer.id, meter.id
        )
        assert customer_meter is not None
        assert customer_meter.activated_at is not None
        assert customer_meter.balance == 100

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_activates_existing_customer_meter(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(customer=customer, meter=meter)
        await save_fixture(customer_meter)

        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 100,
            },
        )

        assert response.status_code == 201

        repository = CustomerMeterRepository.from_session(session)
        updated = await repository.get_by_customer_and_meter(customer.id, meter.id)
        assert updated is not None
        assert updated.activated_at is not None
        assert updated.balance == 100

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_customer_meter_locked(
        self,
        mocker: MockerFixture,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        customer_meter = CustomerMeter(customer=customer, meter=meter)
        await save_fixture(customer_meter)
        mocker.patch(
            "polar.customer_meter.service.CustomerMeterService.update_customer_meter",
            side_effect=DBAPIError(
                "SELECT", {}, Exception("could not obtain lock on row")
            ),
        )
        enqueue_job_mock = mocker.patch("polar.customer_meter.service.enqueue_job")

        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 100,
            },
        )

        assert response.status_code == 201

        repository = CustomerMeterRepository.from_session(session)
        updated = await repository.get_by_customer_and_meter(customer.id, meter.id)
        assert updated is not None
        assert updated.activated_at is not None
        assert updated.balance == 0
        enqueue_job_mock.assert_called_once_with(
            "customer_meter.update_customer", customer.id
        )

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_valid_external_ids(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        customer_meters_with_external_ids: tuple[CustomerMeter, CustomerMeter],
    ) -> None:
        customer.external_id = "usr_1337"
        await save_fixture(customer)
        tool_call_customer_meter, _ = customer_meters_with_external_ids

        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "external_customer_id": "usr_1337",
                "external_meter_id": "tool_call",
                "units": 100,
            },
        )

        assert response.status_code == 201
        json = response.json()
        assert json["customer_id"] == str(customer.id)
        assert json["metadata"]["meter_id"] == str(tool_call_customer_meter.meter_id)

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_replay(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        payload = {
            "customer_id": str(customer.id),
            "meter_id": str(meter.id),
            "units": 100,
            "external_id": "credit_1",
        }

        first = await client.post("/v1/customer-meters/credits", json=payload)
        second = await client.post("/v1/customer-meters/credits", json=payload)

        assert first.status_code == 201
        assert second.status_code == 201
        assert second.json()["id"] == first.json()["id"]

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_conflict(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        payload = {
            "customer_id": str(customer.id),
            "meter_id": str(meter.id),
            "units": 100,
            "external_id": "credit_1",
        }

        first = await client.post("/v1/customer-meters/credits", json=payload)
        second = await client.post(
            "/v1/customer-meters/credits", json={**payload, "units": 200}
        )

        assert first.status_code == 201
        assert second.status_code == 409
        assert second.json()["error"] == "CustomerMeterCreditExternalIDConflict"

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_external_id_used_by_user_event(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            name=SystemEvent.meter_credited,
            external_id="credit_1",
            metadata={"meter_id": str(meter.id), "units": 100, "rollover": False},
        )

        response = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 100,
                "external_id": "credit_1",
            },
        )

        assert response.status_code == 409
        assert response.json()["error"] == "CustomerMeterCreditExternalIDConflict"


class TestReverseCustomerMeterCredit:
    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_reverses_unused_units(
        self,
        save_fixture: SaveFixture,
        session: AsyncSession,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        # Backdated so the stored balance isn't refreshed by the usage below.
        four_hours_ago = utc_now() - timedelta(hours=4)
        credit = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            timestamp=four_hours_ago,
            ingested_at=four_hours_ago,
            metadata={
                "meter_id": str(meter.id),
                "units": 5,
                "rollover": False,
                "reason": "manual",
            },
        )
        await save_fixture(
            CustomerMeter(
                customer=customer,
                meter=meter,
                activated_at=four_hours_ago,
                credited_units=5,
                balance=Decimal(5),
                last_balanced_event=credit,
            )
        )
        credit_id = credit.id
        for parent_id in (credit_id, None, None):
            await create_event(
                save_fixture,
                organization=organization,
                customer=customer,
                parent_id=parent_id,
                timestamp=four_hours_ago + timedelta(minutes=1),
                ingested_at=four_hours_ago + timedelta(minutes=1),
            )

        response = await client.post(f"/v1/customer-meters/credits/{credit_id}/reverse")

        assert response.status_code == 201
        json = response.json()
        assert json["parent_id"] == str(credit_id)
        assert json["metadata"]["units"] == -2
        assert "reversed_event_id" not in json["metadata"]
        reversal = await session.get(Event, uuid.UUID(json["id"]))
        assert reversal is not None
        assert reversal.root_id == credit.root_id
        customer_meter = await CustomerMeterRepository.from_session(
            session
        ).get_by_customer_and_meter(customer.id, meter.id)
        assert customer_meter is not None
        assert customer_meter.balance == 0

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_already_reversed(
        self,
        client: AsyncClient,
        user_organization: UserOrganization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        credit = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 5,
            },
        )
        await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 5,
            },
        )
        url = f"/v1/customer-meters/credits/{credit.json()['id']}/reverse"

        assert (await client.post(url)).status_code == 201
        response = await client.post(url)
        assert response.status_code == 409
        assert response.json()["detail"] == "These credits have already been reversed."

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_used_credit_with_unused_rollover_credit(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        credits = []
        for rollover in (False, True):
            credit = await client.post(
                "/v1/customer-meters/credits",
                json={
                    "customer_id": str(customer.id),
                    "meter_id": str(meter.id),
                    "units": 5,
                    "rollover": rollover,
                },
            )
            credits.append(credit.json()["id"])
        for _ in range(5):
            await create_event(
                save_fixture, organization=organization, customer=customer
            )
        non_rollover_url, rollover_url = (
            f"/v1/customer-meters/credits/{credit_id}/reverse" for credit_id in credits
        )

        response = await client.post(non_rollover_url)
        assert response.status_code == 409
        assert response.json()["detail"] == "These credits have already been used."

        response = await client.post(rollover_url)
        assert response.status_code == 201
        assert response.json()["metadata"]["units"] == -5

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_benefit_credit(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        credit = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={
                "meter_id": str(meter.id),
                "units": 5,
                "rollover": False,
                "reason": "benefit",
            },
        )

        response = await client.post(f"/v1/customer-meters/credits/{credit.id}/reverse")

        assert response.status_code == 404

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_already_invoiced(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[],
        )
        price = await create_product_price_metered_unit(
            save_fixture, product=product, meter=meter
        )
        product.prices.append(price)
        product.all_prices.append(price)
        subscription = await create_active_subscription(
            save_fixture, customer=customer, product=product
        )
        credit = await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_credited,
            metadata={
                "meter_id": str(meter.id),
                "units": 5,
                "rollover": False,
                "reason": "manual",
            },
        )
        order_item = OrderItem(
            label="", amount=0, net_amount=0, tax_amount=0, product_price=price
        )
        await create_order(
            save_fixture,
            customer=customer,
            subscription=subscription,
            order_items=[order_item],
        )
        await save_fixture(
            BillingEntry(
                start_timestamp=credit.timestamp,
                end_timestamp=credit.timestamp,
                type=BillingEntryType.metered,
                direction=BillingEntryDirection.debit,
                customer=customer,
                product_price=price,
                subscription=subscription,
                event=credit,
                order_item=order_item,
            )
        )

        response = await client.post(f"/v1/customer-meters/credits/{credit.id}/reverse")

        assert response.status_code == 409

    @pytest.mark.api_version(V2027_01)
    @pytest.mark.auth
    async def test_previous_period(
        self,
        save_fixture: SaveFixture,
        client: AsyncClient,
        user_organization: UserOrganization,
        organization: Organization,
        customer: Customer,
        meter: Meter,
    ) -> None:
        credit = await client.post(
            "/v1/customer-meters/credits",
            json={
                "customer_id": str(customer.id),
                "meter_id": str(meter.id),
                "units": 5,
            },
        )
        await create_event(
            save_fixture,
            organization=organization,
            customer=customer,
            source=EventSource.system,
            name=SystemEvent.meter_reset,
            timestamp=utc_now() + timedelta(seconds=1),
            metadata={"meter_id": str(meter.id)},
        )

        response = await client.post(
            f"/v1/customer-meters/credits/{credit.json()['id']}/reverse"
        )

        assert response.status_code == 409
