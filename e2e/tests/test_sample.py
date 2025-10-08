from typing import Any

import pytest
from playwright.sync_api import Page, expect


@pytest.fixture
def browser_context_args() -> dict[str, Any]:
    return {
        "base_url": "http://127.0.0.1:3000",
        "screen": {
            "width": 1280,
            "height": 720,
        },
    }


def test_landing(page: Page):
    page.goto("/")
    page.wait_for_selector("h1.leading-tight\\!", state="visible")
    expect(page.get_by_text("Monetize your software")).to_be_visible()
