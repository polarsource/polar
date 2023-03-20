import pytest

from polar.kit.utils import generate_uuid
from polar.models.pledge import Pledge
from polar.postgres import AsyncSession


@pytest.mark.asyncio
@pytest.mark.parametrize(
    "test_amount",
    [1010, 12345678999],
)
async def test_pledge(session: AsyncSession, test_amount: str) -> None:
    email = "alice@polar.sh"

    created = await Pledge.create(
        session,
        issue_id=generate_uuid(),
        repository_id=generate_uuid(),
        organization_id=generate_uuid(),
        email=email,
        amount=int(test_amount),
    )

    assert created.id is not None

    await session.commit()
    await session.refresh(created)

    got = await Pledge.find(session, created.id)
    assert got is not None
    assert got.email == email
    assert got.amount == int(test_amount)
