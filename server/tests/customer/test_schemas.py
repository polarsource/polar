import json
from typing import Any

import pytest
from pydantic import TypeAdapter

from polar.customer.schemas.customer import CustomerResponse as Customer
from polar.customer.schemas.state import CustomerStateResponse as CustomerState
from polar.models import Organization
from tests.fixtures.database import SaveFixture
from tests.fixtures.random_objects import create_customer

_CustomerAdapter: TypeAdapter[Customer] = TypeAdapter(Customer)
_CustomerStateAdapter: TypeAdapter[CustomerState] = TypeAdapter(CustomerState)


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

    customer_schema = _CustomerAdapter.validate_python(customer, from_attributes=True)
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

    customer_state_schema = _CustomerStateAdapter.validate_python(
        customer, from_attributes=True
    )
    assert customer_state_schema.external_id == "EXTERNAL_ID"

    customer_state_json = customer_state_schema.model_dump_json()
    customer_state_serialized = json.loads(customer_state_json)
    assert customer_state_serialized["external_id"] == "EXTERNAL_ID"

    customer_state_deserialized = _CustomerStateAdapter.validate_json(
        customer_state_json
    )
    assert customer_state_deserialized.external_id == "EXTERNAL_ID"
