from datetime import UTC, datetime
from decimal import Decimal
from uuid import uuid4

from polar.void.meter.schemas import Meter


def test_zero_unit_amount_serializes_in_plain_notation() -> None:
    meter = Meter(
        id=uuid4(),
        version_id="a" * 64,
        name="Credits",
        slug="credits",
        usage_reducer_id=uuid4(),
        credit_reducer_id=uuid4(),
        unit_amount=Decimal("0E-12"),
        currency="usd",
        created_at=datetime.now(UTC),
    )

    assert meter.model_dump(mode="json")["unit_amount"] == "0.000000000000"
