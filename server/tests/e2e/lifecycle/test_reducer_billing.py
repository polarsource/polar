"""
E2E: Lifecycle — metered usage billed from the reducers.

Each scenario reads top to bottom: the plans on offer, what the customer does
and when, then the usage lines on the renewal invoice.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import Decimal

import freezegun
import pytest
from httpx import AsyncClient

from polar.auth.scope import Scope
from polar.enums import SubscriptionRecurringInterval
from polar.kit.db.postgres import AsyncSession
from polar.kit.versioning import VERSION_HEADER
from polar.meter.aggregation import (
    Aggregation,
    AggregationFunction,
    PropertyAggregation,
)
from polar.models import Meter, Organization, Product
from polar.reducer.service import reducer as reducer_service
from polar.version import V2027_01
from tests.e2e.infra import DrainFn, SchedulerSimulator, StripeSimulator
from tests.e2e.purchase.conftest import complete_purchase
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import (
    METER_TEST_EVENT,
    create_meter,
    create_product,
)

BASE_FEE = 1500

JAN_15 = datetime.fromisoformat("2024-01-15T12:00:00+00:00")
JAN_20 = datetime.fromisoformat("2024-01-20T12:00:00+00:00")
HALFWAY_THROUGH_FIRST_PERIOD = datetime.fromisoformat("2024-01-31T00:00:00+00:00")
FEB_5 = datetime.fromisoformat("2024-02-05T12:00:00+00:00")
FEB_15 = datetime.fromisoformat("2024-02-15T12:00:00+00:00")
FEB_20 = datetime.fromisoformat("2024-02-20T12:00:00+00:00")
HALFWAY_THROUGH_SECOND_PERIOD = datetime.fromisoformat("2024-03-01T00:00:00+00:00")
MAR_5 = datetime.fromisoformat("2024-03-05T12:00:00+00:00")
MAR_15 = datetime.fromisoformat("2024-03-15T12:00:00+00:00")

auth_subject_fixture = pytest.mark.auth(
    AuthSubjectFixture(
        subject="user",
        scopes={
            Scope.checkouts_read,
            Scope.checkouts_write,
            Scope.orders_read,
            Scope.subscriptions_read,
            Scope.subscriptions_write,
            Scope.events_write,
            Scope.customers_write,
        },
    )
)


@dataclass
class UsageLine:
    plan: str
    amount: int
    label: str


class Scenario:
    def __init__(
        self,
        client: AsyncClient,
        session: AsyncSession,
        stripe_sim: StripeSimulator,
        drain: DrainFn,
        scheduler_sim: SchedulerSimulator,
        organization: Organization,
        save_fixture: SaveFixture,
    ) -> None:
        self.client = client
        self.session = session
        self.stripe_sim = stripe_sim
        self.drain = drain
        self.scheduler_sim = scheduler_sim
        self.organization = organization
        self.save_fixture = save_fixture
        self.meter: Meter
        self.plans: dict[str, str] = {}
        self.customer_id: str
        self.subscription_id: str

    async def given_an_organization_on_reducer_billing_with_a_meter(
        self, aggregation: Aggregation
    ) -> None:
        self.organization.feature_settings = {"reducer_billing_enabled": True}
        await self.save_fixture(self.organization)
        self.meter = await create_meter(
            self.save_fixture, organization=self.organization, aggregation=aggregation
        )
        await reducer_service.sync_meter(self.session, self.meter)

    async def given_a_monthly_plan(self, name: str, *, cents_per_unit: int) -> Product:
        product = await create_product(
            self.save_fixture,
            organization=self.organization,
            name=name,
            recurring_interval=SubscriptionRecurringInterval.month,
            prices=[
                (BASE_FEE, "usd"),
                (self.meter, Decimal(cents_per_unit), None, "usd"),
            ],
            is_tax_applicable=False,
        )
        metered_price = next(
            price for price in product.prices if getattr(price, "meter_id", None)
        )
        self.plans[str(metered_price.id)] = name
        return product

    async def when_the_customer_subscribes(
        self, plan: Product, *, at: datetime
    ) -> None:
        with freezegun.freeze_time(at):
            purchase = await complete_purchase(
                self.client,
                self.session,
                self.stripe_sim,
                self.drain,
                self.organization,
                plan,
                amount=BASE_FEE,
            )
        self.customer_id = purchase.order["customer_id"]
        self.subscription_id = purchase.order["subscription_id"]

    async def when_units_are_included(self, units: int, *, at: datetime) -> None:
        with freezegun.freeze_time(at):
            response = await self.client.post(
                "/v1/customer-meters/credits",
                json={
                    "customer_id": self.customer_id,
                    "meter_id": str(self.meter.id),
                    "units": units,
                },
                headers={VERSION_HEADER: str(V2027_01)},
            )
            assert response.status_code == 201, response.text
            await self.drain(ignored_actors={"email.send"})

    async def when_usage_is_reported(
        self, *values: int, at: datetime, arriving: datetime | None = None
    ) -> None:
        with freezegun.freeze_time(arriving or at + timedelta(minutes=10)):
            response = await self.client.post(
                "/v1/events/ingest",
                json={
                    "events": [
                        {
                            "name": METER_TEST_EVENT,
                            "customer_id": self.customer_id,
                            "organization_id": str(self.organization.id),
                            "timestamp": at.isoformat(),
                            "metadata": {"tokens": value},
                        }
                        for value in values
                    ]
                },
            )
            assert response.status_code == 200, response.text
            await self.drain(ignored_actors={"email.send"})

    async def when_the_customer_switches_to(
        self, plan: Product, *, at: datetime
    ) -> None:
        with freezegun.freeze_time(at):
            response = await self.client.patch(
                f"/v1/subscriptions/{self.subscription_id}",
                json={"product_id": str(plan.id), "proration_behavior": "prorate"},
            )
            assert response.status_code == 200, response.text
            await self.drain(ignored_actors={"email.send"})

    async def when_the_subscription_renews(self, *, at: datetime) -> None:
        async def drain(**_kwargs: object) -> object:
            return await self.drain(ignored_actors={"email.send"})

        with freezegun.freeze_time(at + timedelta(seconds=1)):
            assert await self.scheduler_sim.get_due_count() == 1
            await self.scheduler_sim.trigger_due_cycles(drain)  # type: ignore[arg-type]

    async def then_the_latest_renewal_bills_usage(self) -> list[UsageLine]:
        response = await self.client.get("/v1/orders/", params={"limit": 20})
        assert response.status_code == 200
        renewals = [
            order
            for order in response.json()["items"]
            if order["billing_reason"] == "subscription_cycle"
        ]
        latest = max(renewals, key=lambda order: order["created_at"])
        return [
            UsageLine(
                plan=self.plans[item["product_price_id"]],
                amount=item["amount"],
                label=item["label"],
            )
            for item in latest["items"]
            if item["product_price_id"] in self.plans
        ]


@pytest.fixture
def scenario(
    client: AsyncClient,
    session: AsyncSession,
    stripe_sim: StripeSimulator,
    drain: DrainFn,
    scheduler_sim: SchedulerSimulator,
    organization: Organization,
    save_fixture: SaveFixture,
) -> Scenario:
    return Scenario(
        client, session, stripe_sim, drain, scheduler_sim, organization, save_fixture
    )


def average_of(property: str) -> PropertyAggregation:
    return PropertyAggregation(func=AggregationFunction.avg, property=property)


def max_of(property: str) -> PropertyAggregation:
    return PropertyAggregation(func=AggregationFunction.max, property=property)


def sum_of(property: str) -> PropertyAggregation:
    return PropertyAggregation(func=AggregationFunction.sum, property=property)


@pytest.mark.anyio
class TestAverageMeter:
    @auth_subject_fixture
    async def test_without_a_plan_switch_the_period_average_is_billed_in_full(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_subscription_renews(at=FEB_15)

        (line,) = await scenario.then_the_latest_renewal_bills_usage()
        assert (line.plan, line.amount) == ("Starter", 3 * 1000)
        assert "of the period" not in line.label

    @auth_subject_fixture
    async def test_a_plan_switch_halfway_bills_each_plan_for_half_the_period(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=2000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=FEB_5)
        await scenario.when_the_subscription_renews(at=FEB_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 3 * 1000 // 2)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 3 * 2000 // 2)
        assert "50% of the period" in starter_line.label
        assert "50% of the period" in pro_line.label

    @auth_subject_fixture
    async def test_a_plan_switch_is_prorated_against_the_period_it_happens_in(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=2000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_subscription_renews(at=FEB_15)
        await scenario.when_usage_is_reported(5, at=FEB_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_SECOND_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=MAR_5)
        await scenario.when_the_subscription_renews(at=MAR_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 5 * 1000 // 2)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 3 * 2000 // 2)

    @auth_subject_fixture
    async def test_included_units_come_off_each_plans_average_after_a_switch(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=2000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_units_are_included(2, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=FEB_5)
        await scenario.when_the_subscription_renews(at=FEB_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 1 * 1000 // 2)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 1 * 2000 // 2)

    @auth_subject_fixture
    async def test_usage_arriving_late_for_a_billed_period_is_not_charged(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_subscription_renews(at=FEB_15)
        await scenario.when_usage_is_reported(9, at=JAN_20, arriving=FEB_20)
        await scenario.when_usage_is_reported(3, at=MAR_5)
        await scenario.when_the_subscription_renews(at=MAR_15)

        (line,) = await scenario.then_the_latest_renewal_bills_usage()
        assert (line.plan, line.amount) == ("Starter", 3 * 1000)

    @auth_subject_fixture
    async def test_usage_arriving_late_for_a_plan_left_earlier_is_not_charged(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            average_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=2000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=FEB_5)
        await scenario.when_the_subscription_renews(at=FEB_15)
        await scenario.when_usage_is_reported(6, at=JAN_20, arriving=FEB_20)
        await scenario.when_usage_is_reported(3, at=MAR_5)
        await scenario.when_the_subscription_renews(at=MAR_15)

        (line,) = await scenario.then_the_latest_renewal_bills_usage()
        assert (line.plan, line.amount) == ("Pro", 3 * 2000)


@pytest.mark.anyio
class TestMaxMeter:
    @auth_subject_fixture
    async def test_a_plan_switch_halfway_bills_each_plans_peak_for_half_the_period(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            max_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=1000)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=2000)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=FEB_5)
        await scenario.when_the_subscription_renews(at=FEB_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 4 * 1000 // 2)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 3 * 2000 // 2)


@pytest.mark.anyio
class TestSumMeter:
    @auth_subject_fixture
    async def test_a_plan_switch_bills_usage_at_the_plan_it_happened_on_in_full(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            sum_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=100)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=200)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_usage_is_reported(3, at=FEB_5)
        await scenario.when_the_subscription_renews(at=FEB_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 6 * 100)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 3 * 200)
        assert "of the period" not in starter_line.label
        assert "of the period" not in pro_line.label

    @auth_subject_fixture
    async def test_usage_arriving_late_is_billed_at_the_plan_it_happened_on(
        self, scenario: Scenario
    ) -> None:
        await scenario.given_an_organization_on_reducer_billing_with_a_meter(
            sum_of("tokens")
        )
        starter = await scenario.given_a_monthly_plan("Starter", cents_per_unit=100)
        pro = await scenario.given_a_monthly_plan("Pro", cents_per_unit=200)

        await scenario.when_the_customer_subscribes(starter, at=JAN_15)
        await scenario.when_usage_is_reported(2, 4, at=JAN_20)
        await scenario.when_the_customer_switches_to(
            pro, at=HALFWAY_THROUGH_FIRST_PERIOD
        )
        await scenario.when_the_subscription_renews(at=FEB_15)
        await scenario.when_usage_is_reported(5, at=JAN_20, arriving=FEB_20)
        await scenario.when_usage_is_reported(3, at=MAR_5)
        await scenario.when_the_subscription_renews(at=MAR_15)

        starter_line, pro_line = await scenario.then_the_latest_renewal_bills_usage()
        assert (starter_line.plan, starter_line.amount) == ("Starter", 5 * 100)
        assert (pro_line.plan, pro_line.amount) == ("Pro", 3 * 200)
