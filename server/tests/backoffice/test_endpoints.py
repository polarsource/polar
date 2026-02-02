"""Test backoffice rendering with Jinja2."""

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
        # Check for expected content
        assert "Dashboard" in content
        assert "Polar Backoffice" in content
        # Check for structural elements
        assert "drawer" in content  # Main layout structure
        assert "menu" in content  # Navigation menu

    async def test_index_htmx_partial(self, backoffice_client: AsyncClient) -> None:
        """Test that HTMX boosted requests return partial content."""
        response = await backoffice_client.get(
            "/",
            headers={
                "HX-Request": "true",
                "HX-Boosted": "true",
                "HX-Target": "content",
            },
        )
        assert response.status_code == 200
        content = response.content.decode()
        # Check for content
        assert "Dashboard" in content
        # Check for out-of-band swaps
        assert 'hx-swap-oob="true"' in content
        # Should NOT have full HTML structure (no html/body tags)
        assert "<html" not in content
        assert "<body" not in content
