"""Tests for ``polar.organization_review_agent.lanes.base``.

The Slice 0 ship has no concrete lanes; this exercises the helpers a
later slice uses to validate lane wiring and assert known names.
"""

from __future__ import annotations

import pytest

from polar.organization_review_agent.lanes.base import assert_known_lane_name


class TestAssertKnownLaneName:
    def test_known_name_passes(self) -> None:
        assert_known_lane_name(
            "history", registered={"history", "identity", "payments"}
        )

    def test_unknown_name_raises_with_helpful_message(self) -> None:
        """Failure message must list registered options so the typo is
        obvious — a common error mode when a routing rule references a
        lane that's been renamed.
        """

        with pytest.raises(ValueError) as excinfo:
            assert_known_lane_name(
                "histori",  # missing 'y'
                registered={"history", "identity"},
            )
        message = str(excinfo.value)
        assert "histori" in message
        assert "history" in message
        assert "identity" in message
