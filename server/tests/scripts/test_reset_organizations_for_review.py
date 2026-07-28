from unittest.mock import AsyncMock, call, patch
from uuid import uuid4

import pytest

from polar.postgres import AsyncSession
from scripts.reset_organizations_for_review import _load_organizations


@pytest.mark.asyncio
async def test_load_organizations_locks_targets(session: AsyncSession) -> None:
    organization_ids = [uuid4(), uuid4()]
    get_by_id = AsyncMock(side_effect=[None, None])

    with patch(
        "scripts.reset_organizations_for_review.OrganizationRepository.from_session"
    ) as from_session:
        from_session.return_value.get_by_id = get_by_id
        await _load_organizations(session, organization_ids)

    assert get_by_id.await_args_list == [
        call(
            organization_ids[0],
            include_blocked=True,
            for_update=True,
        ),
        call(
            organization_ids[1],
            include_blocked=True,
            for_update=True,
        ),
    ]
