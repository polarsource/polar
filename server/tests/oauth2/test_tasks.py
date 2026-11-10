import pytest
from pytest_mock import MockerFixture

from polar.oauth2.repository import OAuth2ClientRepository
from polar.oauth2.tasks import oauth2_client_delete_stale


@pytest.mark.anyio
class TestOAuth2ClientDeleteStale:
    async def test_deletes_batches_until_none_left(self, mocker: MockerFixture) -> None:
        delete_stale_mock = mocker.patch.object(
            OAuth2ClientRepository, "delete_stale", side_effect=[1000, 1000, 42, 0]
        )

        await oauth2_client_delete_stale()

        assert delete_stale_mock.await_count == 4
        cutoffs = {call.args[0] for call in delete_stale_mock.await_args_list}
        assert len(cutoffs) == 1
