from unittest.mock import AsyncMock

import pytest
from pytest_mock import MockerFixture

from polar.kit.db.postgres import AsyncSession
from polar.magic_link.service import magic_link as magic_link_service
from polar.magic_link.tasks import magic_link_delete_expired


@pytest.mark.asyncio
async def test_magic_link_delete_expired(
    mocker: MockerFixture, session: AsyncSession
) -> None:
    magic_link_service_send_mock = mocker.patch.object(
        magic_link_service, "delete_expired", new=AsyncMock()
    )

    # then
    session.expunge_all()

    await magic_link_delete_expired()

    magic_link_service_send_mock.assert_called_once()
