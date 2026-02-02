"""Test backoffice rendering with Tagflow (baseline for conversion to Jinja2)."""

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
class TestBackofficeIndex:
    """Test the backoffice index page."""

    async def test_index_renders(self, backoffice_client: AsyncClient) -> None:
        """Test that the backoffice index page renders successfully."""
        response = await backoffice_client.get("/")
        assert response.status_code == 200
        content = response.content.decode()
        # Check for expected content in the Tagflow-rendered page
        assert "Dashboard" in content
        assert "Polar Backoffice" in content
