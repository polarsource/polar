from datetime import UTC, datetime, timedelta

import pytest
from pytest_mock import MockerFixture

from polar.models.organization import EMBED_HOSTS_ENFORCED_FROM

# The organization fixture is created now, which falls past the cohort cutoff
# from 4 August 2026 onwards. Tests covering an unenforced organization pin it.
BEFORE_EMBED_CUTOFF = EMBED_HOSTS_ENFORCED_FROM - timedelta(days=1)


@pytest.fixture
def embed_hosts_not_enforced(mocker: MockerFixture) -> None:
    """Hold the global cutoff in the future: these tests cover the behaviour
    before every organization is held to its list."""
    mocker.patch(
        "polar.models.organization.EMBED_HOSTS_ENFORCED_FOR_ALL",
        datetime(2100, 1, 1, tzinfo=UTC),
    )
