import json
from typing import Any

import pytest

from polar.customer.schemas.customer import Customer
from polar.customer.schemas.state import CustomerState
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("external_id", "user_metadata", "expected"),
    [
        ("EXTERNAL_ID", {}, "EXTERNAL_ID"),
        (None, {"__external_id": "EXTERNAL_ID"}, "EXTERNAL_ID"),
        (None, {}, None),
    ],
)
async def test_external_id(
    external_id: str | None,
    user_metadata: dict[str, Any],
    expected: str | None,
    save_fixture: SaveFixture,
    organization: Organization,
) -> None:
    customer = await create_customer(
        save_fixture,
        organization=organization,
        external_id=external_id,
        user_metadata=user_metadata,
    )

    customer_schema = Customer.model_validate(customer)
    assert customer_schema.external_id == expected


@pytest.mark.asyncio
async def test_state_external_id(
    save_fixture: SaveFixture, organization: Organization
) -> None:
    customer = await create_customer(
        save_fixture, organization=organization, external_id="EXTERNAL_ID"
    )

    customer.active_subscriptions = []
    customer.granted_benefits = []
    customer.active_meters = []

    customer_state_schema = CustomerState.model_validate(customer)
    assert customer_state_schema.external_id == "EXTERNAL_ID"

    customer_state_json = customer_state_schema.model_dump_json()
    customer_state_serialized = json.loads(customer_state_json)
    assert customer_state_serialized["external_id"] == "EXTERNAL_ID"

    customer_state_deserialized = CustomerState.model_validate_json(customer_state_json)
    assert customer_state_deserialized.external_id == "EXTERNAL_ID"
