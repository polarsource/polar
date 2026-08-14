import pytest
from sqlalchemy import func, select

from polar.event_type.repository import EventTypeRepository
from polar.kit.utils import utc_now
from polar.models import EventType, Organization
from polar.postgres import AsyncSession


@pytest.mark.asyncio
async def test_ensure_by_names_is_idempotent(
    session: AsyncSession, organization: Organization
) -> None:
    repository = EventTypeRepository.from_session(session)

    first = await repository.ensure_by_names(
        ["subscription.created", "checkout.created", "subscription.created"],
        organization.id,
    )
    second = await repository.ensure_by_names(
        ["checkout.created", "subscription.created"], organization.id
    )

    assert set(first) == {"checkout.created", "subscription.created"}
    assert {name: event_type.id for name, event_type in first.items()} == {
        name: event_type.id for name, event_type in second.items()
    }
    assert (
        await session.scalar(
            select(func.count(EventType.id)).where(
                EventType.organization_id == organization.id
            )
        )
        == 2
    )


@pytest.mark.asyncio
async def test_ensure_by_names_restores_soft_deleted_type(
    session: AsyncSession, organization: Organization
) -> None:
    repository = EventTypeRepository.from_session(session)
    created = await repository.ensure_by_names(
        ["subscription.created"], organization.id
    )
    event_type = created["subscription.created"]
    event_type.label = "Subscription started"
    event_type.deleted_at = utc_now()
    await session.flush()

    restored = await repository.ensure_by_names(
        ["subscription.created"], organization.id
    )

    restored_event_type = restored["subscription.created"]
    assert restored_event_type.id == event_type.id
    assert restored_event_type.label == "Subscription started"
    assert restored_event_type.deleted_at is None
    assert (
        await session.scalar(
            select(EventType.deleted_at).where(EventType.id == event_type.id)
        )
        is None
    )
