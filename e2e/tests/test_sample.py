import os
from datetime import datetime, timedelta

import pytest
from playwright.sync_api import Browser, BrowserContext, Page, expect


@pytest.fixture(scope="session")
def user_session() -> str:
    try:
        return os.environ["POLAR_E2E_USER_SESSION"]
    except KeyError as e:
        raise RuntimeError(
            "Please set the POLAR_E2E_USER_SESSION environment variable to a valid user session token."
        ) from e


@pytest.fixture
def context(browser: Browser, user_session: str) -> BrowserContext:
    return browser.new_context(
        base_url="http://127.0.0.1:3000",
        screen={
            "width": 1280,
            "height": 720,
        },
        storage_state={
            "cookies": [
                {
                    "name": "polar_session",
                    "value": user_session,
                    "domain": "127.0.0.1",
                    "path": "/",
                    "expires": (datetime.now() + timedelta(days=1)).timestamp(),
                    "httpOnly": True,
                    "secure": False,
                    "sameSite": "Lax",
                }
            ]
        },
    )


def test_landing(page: Page) -> None:
    page.goto("/dashboard/frankie567")
    expect(page.get_by_text("Revenue")).to_be_visible()
