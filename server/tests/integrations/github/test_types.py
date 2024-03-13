import pytest
from githubkit.versions.latest.models import AppPermissions

from polar.integrations.github.types import app_permissions_from_github


@pytest.mark.asyncio
async def test_app_permissions_from_github() -> None:
    r = app_permissions_from_github(
        AppPermissions(packages="write", secret_scanning_alerts="read")
    )

    assert r.get("packages") == "write"
    assert r.get("secret_scanning_alerts") == "read"
