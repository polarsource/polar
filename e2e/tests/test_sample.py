from playwright.sync_api import Page, expect


def test_landing(page: Page):
    page.goto("/")
    expect(page.get_by_text("Monetize your software")).to_be_visible()
