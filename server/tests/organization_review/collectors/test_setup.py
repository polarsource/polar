from unittest.mock import MagicMock

from polar.organization_review.collectors.setup import (
    _extract_domain,
    collect_setup_data,
)
from polar.organization_review.schemas import (
    CheckoutLinksData,
    CheckoutReturnUrlData,
    CheckoutSuccessUrlData,
    IntegrationData,
    SetupData,
)


def _build_checkout_link(
    *,
    label: str | None = None,
    success_url: str | None = None,
    products: list[tuple[str, bool]] | None = None,
) -> MagicMock:
    """Build a mock CheckoutLink.

    products is a list of (product_name, has_benefits) tuples.
    """
    link = MagicMock()
    link.label = label
    link.success_url = success_url

    clps = []
    if products:
        for name, has_benefits in products:
            clp = MagicMock()
            clp.product.name = name
            clp.product.product_benefits = [MagicMock()] if has_benefits else []
            clps.append(clp)
    link.checkout_link_products = clps
    return link


def _build_webhook_endpoint(*, url: str = "https://example.com/webhook") -> MagicMock:
    ep = MagicMock()
    ep.url = url
    return ep


class TestExtractDomain:
    def test_simple_url(self) -> None:
        assert _extract_domain("https://example.com/path") == "example.com"

    def test_url_with_port(self) -> None:
        assert _extract_domain("https://example.com:8080/path") == "example.com:8080"

    def test_no_scheme(self) -> None:
        # urlparse without scheme puts everything in path
        assert _extract_domain("example.com/path") is None

    def test_empty_string(self) -> None:
        assert _extract_domain("") is None

    def test_http_url(self) -> None:
        assert _extract_domain("http://my-site.org") == "my-site.org"


class TestCollectSetupDataEmpty:
    def test_all_empty(self) -> None:
        result = collect_setup_data(
            checkout_links=[],
            checkout_return_urls=[],
            api_key_count=0,
            webhook_endpoints=[],
        )
        assert result == SetupData()

    def test_default_values(self) -> None:
        result = collect_setup_data([], [], 0, [])
        assert result.checkout_success_urls == CheckoutSuccessUrlData()
        assert result.checkout_return_urls == CheckoutReturnUrlData()
        assert result.checkout_links == CheckoutLinksData()
        assert result.integration == IntegrationData()


class TestCollectSetupDataSuccessUrls:
    def test_unique_success_urls(self) -> None:
        link1 = _build_checkout_link(success_url="https://example.com/thanks")
        link2 = _build_checkout_link(success_url="https://other.com/done")
        link3 = _build_checkout_link(success_url="https://example.com/thanks")  # dup

        result = collect_setup_data([link1, link2, link3], [], 0, [])

        assert result.checkout_success_urls.unique_urls == [
            "https://example.com/thanks",
            "https://other.com/done",
        ]
        assert set(result.checkout_success_urls.domains) == {
            "example.com",
            "other.com",
        }

    def test_none_success_url_skipped(self) -> None:
        link = _build_checkout_link(success_url=None)
        result = collect_setup_data([link], [], 0, [])
        assert result.checkout_success_urls.unique_urls == []

    def test_domains_deduplicated(self) -> None:
        link1 = _build_checkout_link(success_url="https://example.com/a")
        link2 = _build_checkout_link(success_url="https://example.com/b")

        result = collect_setup_data([link1, link2], [], 0, [])

        assert result.checkout_success_urls.unique_urls == [
            "https://example.com/a",
            "https://example.com/b",
        ]
        assert result.checkout_success_urls.domains == ["example.com"]


class TestCollectSetupDataReturnUrls:
    def test_return_urls_and_domains(self) -> None:
        urls = ["https://app.example.com/return", "https://other.io/callback"]
        result = collect_setup_data([], urls, 0, [])

        assert result.checkout_return_urls.unique_urls == urls
        assert set(result.checkout_return_urls.domains) == {
            "app.example.com",
            "other.io",
        }

    def test_empty_return_urls(self) -> None:
        result = collect_setup_data([], [], 0, [])
        assert result.checkout_return_urls.unique_urls == []
        assert result.checkout_return_urls.domains == []


class TestCollectSetupDataCheckoutLinks:
    def test_links_with_benefits(self) -> None:
        link = _build_checkout_link(
            label="my-link",
            products=[("Pro Plan", True), ("Starter", False)],
        )
        result = collect_setup_data([link], [], 0, [])

        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 0
        assert result.checkout_links.links[0].label == "my-link"
        assert result.checkout_links.links[0].product_names == ["Pro Plan", "Starter"]
        assert result.checkout_links.links[0].has_benefits is True

    def test_links_without_benefits(self) -> None:
        link = _build_checkout_link(products=[("Empty Product", False)])
        result = collect_setup_data([link], [], 0, [])

        assert result.checkout_links.links_without_benefits == 1
        assert result.checkout_links.links[0].has_benefits is False

    def test_link_no_products(self) -> None:
        link = _build_checkout_link(products=[])
        result = collect_setup_data([link], [], 0, [])

        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 1
        assert result.checkout_links.links[0].product_names == []

    def test_label_none(self) -> None:
        link = _build_checkout_link(label=None, products=[])
        result = collect_setup_data([link], [], 0, [])
        assert result.checkout_links.links[0].label is None

    def test_multiple_links_counts(self) -> None:
        link_with = _build_checkout_link(products=[("A", True)])
        link_without1 = _build_checkout_link(products=[("B", False)])
        link_without2 = _build_checkout_link(products=[("C", False)])

        result = collect_setup_data([link_with, link_without1, link_without2], [], 0, [])

        assert result.checkout_links.total_links == 3
        assert result.checkout_links.links_without_benefits == 2


class TestCollectSetupDataIntegration:
    def test_api_key_count(self) -> None:
        result = collect_setup_data([], [], 5, [])
        assert result.integration.api_key_count == 5

    def test_webhook_endpoints(self) -> None:
        ep1 = _build_webhook_endpoint(url="https://myapp.com/webhook")
        ep2 = _build_webhook_endpoint(url="https://myapp.com/webhook2")
        ep3 = _build_webhook_endpoint(url="https://other.com/hook")

        result = collect_setup_data([], [], 0, [ep1, ep2, ep3])

        assert result.integration.webhook_urls == [
            "https://myapp.com/webhook",
            "https://myapp.com/webhook2",
            "https://other.com/hook",
        ]
        assert set(result.integration.webhook_domains) == {"myapp.com", "other.com"}

    def test_no_webhooks(self) -> None:
        result = collect_setup_data([], [], 0, [])
        assert result.integration.webhook_urls == []
        assert result.integration.webhook_domains == []


class TestCollectSetupDataCombined:
    def test_full_setup(self) -> None:
        """Integration test with all data populated."""
        link = _build_checkout_link(
            label="buy-now",
            success_url="https://shop.example.com/thanks",
            products=[("Widget", True)],
        )
        return_urls = ["https://shop.example.com/return"]
        ep = _build_webhook_endpoint(url="https://shop.example.com/events")

        result = collect_setup_data([link], return_urls, 2, [ep])

        assert result.checkout_success_urls.domains == ["shop.example.com"]
        assert result.checkout_return_urls.domains == ["shop.example.com"]
        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 0
        assert result.integration.api_key_count == 2
        assert result.integration.webhook_domains == ["shop.example.com"]
