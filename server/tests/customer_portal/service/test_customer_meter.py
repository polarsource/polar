import uuid
from decimal import Decimal

import pytest

from polar.auth.models import AuthSubject
from polar.customer_portal.service.customer_meter import (
    customer_meter as customer_meter_service,
)
from polar.kit.db.postgres import AsyncSession
from polar.kit.pagination import PaginationParams
from polar.models import Customer, CustomerMeter, Organization, SubscriptionMeter
from tests.fixtures.auth import AuthSubjectFixture
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_active_subscription, create_meter


@pytest.mark.asyncio
class TestList:
    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_filters_by_meter_name(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        from polar.enums import SubscriptionRecurringInterval

        from tests.fixtures.random_objects import create_product

        # Create meters with different names
        meter_match = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="API Requests Meter",
        )
        meter_no_match = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="Storage Usage Meter",
        )

        # Create a product and subscription for the customer
        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        # Create SubscriptionMeters to make the meters readable
        subscription_meter_match = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_match.id,
        )
        subscription_meter_no_match = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_no_match.id,
        )
        await save_fixture(subscription_meter_match)
        await save_fixture(subscription_meter_no_match)

        # Create CustomerMeters
        customer_meter_match = CustomerMeter(
            customer=customer,
            meter=meter_match,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        customer_meter_no_match = CustomerMeter(
            customer=customer,
            meter=meter_no_match,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter_match)
        await save_fixture(customer_meter_no_match)

        results, count = await customer_meter_service.list(
            session, auth_subject, query="API Requests", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].meter.name == "API Requests Meter"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_percent_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that % in query is treated as literal, not wildcard."""
        from polar.enums import SubscriptionRecurringInterval

        from tests.fixtures.random_objects import create_product

        meter_with_percent = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="50% Discount Meter",
        )
        meter_without_percent = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="Half Price Meter",
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        subscription_meter_with = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_with_percent.id,
        )
        subscription_meter_without = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_without_percent.id,
        )
        await save_fixture(subscription_meter_with)
        await save_fixture(subscription_meter_without)

        customer_meter_with = CustomerMeter(
            customer=customer,
            meter=meter_with_percent,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        customer_meter_without = CustomerMeter(
            customer=customer,
            meter=meter_without_percent,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter_with)
        await save_fixture(customer_meter_without)

        results, count = await customer_meter_service.list(
            session, auth_subject, query="50%", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].meter.name == "50% Discount Meter"

    @pytest.mark.auth(AuthSubjectFixture(subject="customer"))
    async def test_query_escapes_underscore_character(
        self,
        auth_subject: AuthSubject[Customer],
        save_fixture: SaveFixture,
        session: AsyncSession,
        organization: Organization,
        customer: Customer,
    ) -> None:
        """Test that _ in query is treated as literal, not single-char wildcard."""
        from polar.enums import SubscriptionRecurringInterval

        from tests.fixtures.random_objects import create_product

        meter_with_underscore = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="api_calls",
        )
        meter_without_underscore = await create_meter(
            save_fixture,
            organization=organization,
            id=uuid.uuid4(),
            name="apiXcalls",
        )

        product = await create_product(
            save_fixture,
            organization=organization,
            recurring_interval=SubscriptionRecurringInterval.month,
        )
        subscription = await create_active_subscription(
            save_fixture,
            product=product,
            customer=customer,
        )

        subscription_meter_with = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_with_underscore.id,
        )
        subscription_meter_without = SubscriptionMeter(
            subscription_id=subscription.id,
            meter_id=meter_without_underscore.id,
        )
        await save_fixture(subscription_meter_with)
        await save_fixture(subscription_meter_without)

        customer_meter_with = CustomerMeter(
            customer=customer,
            meter=meter_with_underscore,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        customer_meter_without = CustomerMeter(
            customer=customer,
            meter=meter_without_underscore,
            consumed_units=Decimal(0),
            credited_units=0,
            balance=Decimal(0),
        )
        await save_fixture(customer_meter_with)
        await save_fixture(customer_meter_without)

        results, count = await customer_meter_service.list(
            session, auth_subject, query="api_calls", pagination=PaginationParams(1, 10)
        )

        assert count == 1
        assert results[0].meter.name == "api_calls"
