import httpx2
import pytest

from polar.checkout_link.app import app


@pytest.mark.anyio
async def test_robots_txt_disallows_all() -> None:
    async with httpx2.AsyncClient(
        transport=httpx2.ASGITransport(app=app), base_url="http://buy.polar.sh"
    ) as client:
        response = await client.get("/robots.txt")

    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/plain")
    assert response.text == "User-agent: *\nDisallow: /\n"
