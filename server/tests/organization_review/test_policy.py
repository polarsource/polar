import pytest
from pytest_mock import MockerFixture

from polar.organization_review import policy


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    policy._cache = None


def _cache_source() -> str:
    assert policy._cache is not None
    return policy._cache[2]


class _EmptyResponse:
    status_code = 200
    text = "   \n  "


class _StubClient:
    async def __aenter__(self) -> "_StubClient":
        return self

    async def __aexit__(self, *args: object) -> bool:
        return False

    async def get(self, *args: object, **kwargs: object) -> _EmptyResponse:
        return _EmptyResponse()


@pytest.mark.asyncio
class TestFetchPolicyContent:
    async def test_returns_and_caches_live_content(self, mocker: MockerFixture) -> None:
        download = mocker.patch.object(
            policy, "_download_policy", return_value="LIVE POLICY"
        )

        assert await policy.fetch_policy_content() == "LIVE POLICY"
        assert await policy.fetch_policy_content() == "LIVE POLICY"

        assert download.call_count == 1  # second call served from cache
        assert _cache_source() == "live"

    async def test_falls_back_to_committed_policy_on_failure(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )

        result = await policy.fetch_policy_content()

        assert result == policy._load_fallback_policy()
        assert "Acceptable Use Policy" in result
        assert _cache_source() == "fallback"

    async def test_serves_stale_live_value_over_fallback(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(policy, "_download_policy", return_value="LIVE POLICY")
        await policy.fetch_policy_content()  # populate cache with a live value

        # Force the cache to look expired, then make the refresh fail.
        assert policy._cache is not None
        policy._cache = (policy._cache[0] - 10_000, policy._cache[1], "live")
        mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )

        result = await policy.fetch_policy_content()

        assert result == "LIVE POLICY"
        assert result != policy._load_fallback_policy()

    async def test_backoff_holds_then_retries(self, mocker: MockerFixture) -> None:
        download = mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )

        first = await policy.fetch_policy_content()
        assert download.call_count == 1

        # Within the backoff window: served from cache, no refetch.
        second = await policy.fetch_policy_content()
        assert second == first
        assert download.call_count == 1

        # Age the cache past the backoff window: refetch is attempted.
        assert policy._cache is not None
        ts, content, source = policy._cache
        policy._cache = (ts - policy._FAILURE_RETRY_SECONDS - 1, content, source)
        await policy.fetch_policy_content()
        assert download.call_count == 2

    async def test_successful_refetch_replaces_fallback(
        self, mocker: MockerFixture
    ) -> None:
        download = mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )
        await policy.fetch_policy_content()
        assert _cache_source() == "fallback"

        # Age past the backoff window, then let the download succeed.
        assert policy._cache is not None
        ts, content, source = policy._cache
        policy._cache = (ts - policy._FAILURE_RETRY_SECONDS - 1, content, source)
        download.side_effect = None
        download.return_value = "LIVE POLICY"

        result = await policy.fetch_policy_content()

        assert result == "LIVE POLICY"
        assert _cache_source() == "live"

    async def test_download_rejects_empty_export(self, mocker: MockerFixture) -> None:
        mocker.patch.object(policy, "_get_access_token", return_value="token")
        mocker.patch(
            "polar.organization_review.policy.httpx.AsyncClient",
            return_value=_StubClient(),
        )

        with pytest.raises(policy.AUPPolicyError, match="empty"):
            await policy._download_policy()
