import pytest
from pytest_mock import MockerFixture

from polar.organization_review import policy


@pytest.fixture(autouse=True)
def _reset_cache() -> None:
    policy._cache = None


@pytest.mark.asyncio
class TestFetchPolicyContent:
    async def test_returns_live_content(self, mocker: MockerFixture) -> None:
        mocker.patch.object(policy, "_download_policy", return_value="LIVE POLICY")

        assert await policy.fetch_policy_content() == "LIVE POLICY"

    async def test_falls_back_to_committed_policy_on_failure(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )

        result = await policy.fetch_policy_content()

        assert result == policy._load_fallback_policy()
        assert "Acceptable Use Policy" in result

    async def test_serves_stale_cache_over_fallback(
        self, mocker: MockerFixture
    ) -> None:
        mocker.patch.object(policy, "_download_policy", return_value="LIVE POLICY")
        await policy.fetch_policy_content()  # populate cache

        # Force the cache to look expired, then make the refresh fail.
        assert policy._cache is not None
        policy._cache = (policy._cache[0] - 10_000, policy._cache[1])
        mocker.patch.object(
            policy, "_download_policy", side_effect=policy.AUPPolicyError("drive down")
        )

        result = await policy.fetch_policy_content()

        assert result == "LIVE POLICY"
        assert result != policy._load_fallback_policy()
