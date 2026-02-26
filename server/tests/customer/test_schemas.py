from typing import Any

import pytest

from polar.customer.schemas.customer import Customer
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
