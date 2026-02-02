"""Test backoffice rendering with Jinja2."""

import pytest
from bs4 import BeautifulSoup
from httpx import AsyncClient


@pytest.mark.asyncio
class TestBackofficeIndex:
    """Test the backoffice index page."""

    async def test_index_renders(self, backoffice_client: AsyncClient) -> None:
        """Test that the backoffice index page renders successfully."""
        response = await backoffice_client.get("/")
        assert response.status_code == 200
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Check for full page structure
        assert soup.html is not None
        assert soup.body is not None
        
        # Check title
        title = soup.find("title")
        assert title is not None
        assert "Polar Backoffice" in title.text
        
        # Check for main content
        h1 = soup.find("h1")
        assert h1 is not None
        assert "Dashboard" in h1.text
        
        # Check for drawer layout structure
        drawer = soup.find("div", class_="drawer")
        assert drawer is not None
        
        # Check for navigation menu
        menu = soup.find("ul", class_="menu")
        assert menu is not None
        
        # Check for sidebar with logo
        logo_imgs = soup.find_all("img", src=lambda x: x and "logo" in x)
        assert len(logo_imgs) >= 1

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
        
        soup = BeautifulSoup(response.content, "html.parser")
        
        # Should NOT have full HTML structure
        assert soup.html is None
        assert soup.body is None
        
        # Check for main content
        h1 = soup.find("h1")
        assert h1 is not None
        assert "Dashboard" in h1.text
        
        # Check for breadcrumbs (partial includes this)
        breadcrumbs = soup.find("div", class_="breadcrumbs")
        assert breadcrumbs is not None
        
        # Check for out-of-band swaps
        # Title with hx-swap-oob
        title = soup.find("title", {"hx-swap-oob": "true"})
        assert title is not None
        assert "Polar Backoffice" in title.text
        
        # Menu with hx-swap-oob
        menu = soup.find("ul", {"id": "menu", "hx-swap-oob": "true"})
        assert menu is not None
