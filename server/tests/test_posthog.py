from typing import Any

import pytest
from pytest_mock import MockerFixture

from polar.posthog import posthog


@pytest.mark.anyio
class TestGetFeatureFlagVariant:
    @pytest.mark.parametrize(
        ("flags", "expected_variant"),
        [
            ({"flag": "treatment"}, "treatment"),
            ({"flag": False}, None),
            ({}, None),
            (None, None),
            (Exception("PostHog is down"), None),
        ],
    )
    async def test_variant(
        self, flags: Any, expected_variant: str | None, mocker: MockerFixture
    ) -> None:
        client_mock = mocker.patch.object(posthog, "client")
        client_mock.get_all_flags.side_effect = [flags]

        variant = await posthog.get_feature_flag_variant("flag", "distinct_id")

        assert variant == expected_variant
