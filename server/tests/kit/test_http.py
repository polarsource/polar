import pytest

from polar.kit.http import get_safe_return_url


@pytest.mark.asyncio
async def test_get_safe_return_url() -> None:
    assert get_safe_return_url("/foo") == "http://127.0.0.1:3000/foo"

    assert (
        get_safe_return_url("http://127.0.0.1:3000/foo") == "http://127.0.0.1:3000/foo"
    )

    assert get_safe_return_url("") == "http://127.0.0.1:3000/feed"

    assert (
        get_safe_return_url("https://whatever.com/hey") == "http://127.0.0.1:3000/feed"
    )
