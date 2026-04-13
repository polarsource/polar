from unittest.mock import MagicMock

import pytest
from pytest_mock import MockerFixture

from polar.organization_review.collectors.setup import (
    _extract_domain,
    _normalize_domain,
    collect_setup_data,
    resolve_url_redirects,
)
from polar.organization_review.schemas import (
    CheckoutLinksData,
    CheckoutReturnUrlData,
    CheckoutSuccessUrlData,
    IntegrationData,
    SetupData,
    UrlRedirectInfo,
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


def _build_webhook_endpoint(
    *, url: str = "https://example.com/webhook", enabled: bool = True
) -> MagicMock:
    ep = MagicMock()
    ep.url = url
    ep.enabled = enabled
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


class TestNormalizeDomain:
    def test_strips_www(self) -> None:
        assert _normalize_domain("www.example.com") == "example.com"

    def test_bare_domain_unchanged(self) -> None:
        assert _normalize_domain("example.com") == "example.com"

    def test_non_www_subdomain_unchanged(self) -> None:
        assert _normalize_domain("app.example.com") == "app.example.com"

    def test_www_only(self) -> None:
        assert _normalize_domain("www.com") == "com"


class TestCollectSetupDataEmpty:
    def test_all_empty(self) -> None:
        result = collect_setup_data(
            checkout_links=[],
            checkout_return_urls=[],
            checkout_success_urls=[],
            api_key_count=0,
            webhook_endpoints=[],
        )
        assert result == SetupData()

    def test_default_values(self) -> None:
        result = collect_setup_data([], [], [], 0, [])
        assert result.checkout_success_urls == CheckoutSuccessUrlData()
        assert result.checkout_return_urls == CheckoutReturnUrlData()
        assert result.checkout_links == CheckoutLinksData()
        assert result.integration == IntegrationData()


class TestCollectSetupDataSuccessUrls:
    def test_unique_success_urls(self) -> None:
        link1 = _build_checkout_link(success_url="https://example.com/thanks")
        link2 = _build_checkout_link(success_url="https://other.com/done")
        link3 = _build_checkout_link(success_url="https://example.com/thanks")  # dup

        result = collect_setup_data([link1, link2, link3], [], [], 0, [])

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
        result = collect_setup_data([link], [], [], 0, [])
        assert result.checkout_success_urls.unique_urls == []

    def test_domains_deduplicated(self) -> None:
        link1 = _build_checkout_link(success_url="https://example.com/a")
        link2 = _build_checkout_link(success_url="https://example.com/b")

        result = collect_setup_data([link1, link2], [], [], 0, [])

        assert result.checkout_success_urls.unique_urls == [
            "https://example.com/a",
            "https://example.com/b",
        ]
        assert result.checkout_success_urls.domains == ["example.com"]

    def test_checkout_success_urls_merged(self) -> None:
        """Success URLs from both CheckoutLink and Checkout are merged."""
        link = _build_checkout_link(success_url="https://example.com/thanks")
        checkout_urls = [
            "https://other.com/done",
            "https://example.com/thanks",  # dup with link
        ]

        result = collect_setup_data([link], [], checkout_urls, 0, [])

        assert result.checkout_success_urls.unique_urls == [
            "https://example.com/thanks",
            "https://other.com/done",
        ]
        assert set(result.checkout_success_urls.domains) == {
            "example.com",
            "other.com",
        }

    def test_checkout_success_urls_only_from_checkouts(self) -> None:
        """Success URLs from API-created checkouts appear even without links."""
        result = collect_setup_data([], [], ["https://api-app.com/success"], 0, [])

        assert result.checkout_success_urls.unique_urls == [
            "https://api-app.com/success",
        ]
        assert result.checkout_success_urls.domains == ["api-app.com"]

    def test_redirect_results_included(self) -> None:
        """Redirect results are stored in the success URL data."""
        redirects = [
            UrlRedirectInfo(
                original_url="https://api.scam.com/success",
                final_url="https://porn-site.com/landing",
                final_domain="porn-site.com",
                redirected=True,
            )
        ]
        result = collect_setup_data([], [], [], 0, [], success_url_redirects=redirects)
        assert len(result.checkout_success_urls.redirect_results) == 1
        assert result.checkout_success_urls.redirect_results[0].redirected is True
        assert (
            result.checkout_success_urls.redirect_results[0].final_domain
            == "porn-site.com"
        )


class TestCollectSetupDataReturnUrls:
    def test_return_urls_and_domains(self) -> None:
        urls = ["https://app.example.com/return", "https://other.io/callback"]
        result = collect_setup_data([], urls, [], 0, [])

        assert result.checkout_return_urls.unique_urls == urls
        assert set(result.checkout_return_urls.domains) == {
            "app.example.com",
            "other.io",
        }

    def test_empty_return_urls(self) -> None:
        result = collect_setup_data([], [], [], 0, [])
        assert result.checkout_return_urls.unique_urls == []
        assert result.checkout_return_urls.domains == []

    def test_return_url_redirect_results(self) -> None:
        redirects = [
            UrlRedirectInfo(
                original_url="https://app.example.com/return",
                final_url="https://app.example.com/return",
                final_domain="app.example.com",
                redirected=False,
            )
        ]
        result = collect_setup_data(
            [],
            ["https://app.example.com/return"],
            [],
            0,
            [],
            return_url_redirects=redirects,
        )
        assert len(result.checkout_return_urls.redirect_results) == 1
        assert result.checkout_return_urls.redirect_results[0].redirected is False


class TestCollectSetupDataCheckoutLinks:
    def test_links_with_benefits(self) -> None:
        link = _build_checkout_link(
            label="my-link",
            products=[("Pro Plan", True), ("Starter", False)],
        )
        result = collect_setup_data([link], [], [], 0, [])

        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 0
        assert result.checkout_links.links[0].label == "my-link"
        assert result.checkout_links.links[0].product_names == ["Pro Plan", "Starter"]
        assert result.checkout_links.links[0].has_benefits is True

    def test_links_without_benefits(self) -> None:
        link = _build_checkout_link(products=[("Empty Product", False)])
        result = collect_setup_data([link], [], [], 0, [])

        assert result.checkout_links.links_without_benefits == 1
        assert result.checkout_links.links[0].has_benefits is False

    def test_link_no_products(self) -> None:
        link = _build_checkout_link(products=[])
        result = collect_setup_data([link], [], [], 0, [])

        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 1
        assert result.checkout_links.links[0].product_names == []

    def test_label_none(self) -> None:
        link = _build_checkout_link(label=None, products=[])
        result = collect_setup_data([link], [], [], 0, [])
        assert result.checkout_links.links[0].label is None

    def test_multiple_links_counts(self) -> None:
        link_with = _build_checkout_link(products=[("A", True)])
        link_without1 = _build_checkout_link(products=[("B", False)])
        link_without2 = _build_checkout_link(products=[("C", False)])

        result = collect_setup_data(
            [link_with, link_without1, link_without2], [], [], 0, []
        )

        assert result.checkout_links.total_links == 3
        assert result.checkout_links.links_without_benefits == 2


class TestCollectSetupDataIntegration:
    def test_api_key_count(self) -> None:
        result = collect_setup_data([], [], [], 5, [])
        assert result.integration.api_key_count == 5

    def test_webhook_endpoints(self) -> None:
        ep1 = _build_webhook_endpoint(url="https://myapp.com/webhook")
        ep2 = _build_webhook_endpoint(url="https://myapp.com/webhook2")
        ep3 = _build_webhook_endpoint(url="https://other.com/hook")

        result = collect_setup_data([], [], [], 0, [ep1, ep2, ep3])

        assert [ep.url for ep in result.integration.webhook_endpoints] == [
            "https://myapp.com/webhook",
            "https://myapp.com/webhook2",
            "https://other.com/hook",
        ]
        assert all(ep.enabled for ep in result.integration.webhook_endpoints)
        assert set(result.integration.webhook_domains) == {"myapp.com", "other.com"}

    def test_no_webhooks(self) -> None:
        result = collect_setup_data([], [], [], 0, [])
        assert result.integration.webhook_endpoints == []
        assert result.integration.webhook_domains == []


class TestCollectSetupDataKnownDomains:
    def test_webhook_known_domains(self) -> None:
        ep1 = _build_webhook_endpoint(url="https://myapp.com/webhook")
        ep2 = _build_webhook_endpoint(url="https://discord.com/api/webhooks/123")
        ep3 = _build_webhook_endpoint(url="https://hooks.zapier.com/hook/abc")

        result = collect_setup_data([], [], [], 0, [ep1, ep2, ep3])

        assert set(result.integration.webhook_known_service_domains) == {
            "discord.com",
            "hooks.zapier.com",
        }

    def test_webhook_wildcard_known_domains(self) -> None:
        ep = _build_webhook_endpoint(
            url="https://myproject.supabase.co/functions/v1/hook"
        )

        result = collect_setup_data([], [], [], 0, [ep])

        assert result.integration.webhook_known_service_domains == [
            "myproject.supabase.co"
        ]

    def test_empty_when_all_custom(self) -> None:
        ep = _build_webhook_endpoint(url="https://mystore.com/webhook")

        result = collect_setup_data([], [], [], 0, [ep])

        assert result.integration.webhook_known_service_domains == []


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

        result = collect_setup_data([link], return_urls, [], 2, [ep])

        assert result.checkout_success_urls.domains == ["shop.example.com"]
        assert result.checkout_return_urls.domains == ["shop.example.com"]
        assert result.checkout_links.total_links == 1
        assert result.checkout_links.links_without_benefits == 0
        assert result.integration.api_key_count == 2
        assert result.integration.webhook_domains == ["shop.example.com"]


class TestResolveUrlRedirects:
    """Tests for resolve_url_redirects.

    All tests patch _validate_url_host to skip DNS resolution / SSRF checks,
    since test domains don't resolve in CI.
    """

    @pytest.mark.asyncio
    async def test_empty_urls(self) -> None:
        results = await resolve_url_redirects([])
        assert results == []

    @pytest.mark.asyncio
    async def test_no_redirect(self, mocker: MockerFixture) -> None:
        """URL that does not redirect reports redirected=False."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://example.com/thanks",
                final_url="https://example.com/thanks",
                final_domain="example.com",
                redirected=False,
            ),
        )

        with respx.mock:
            respx.head("https://example.com/thanks").respond(200)
            results = await resolve_url_redirects(["https://example.com/thanks"])

        assert len(results) == 1
        assert results[0].redirected is False
        assert results[0].final_domain == "example.com"

    @pytest.mark.asyncio
    async def test_cross_domain_redirect(self, mocker: MockerFixture) -> None:
        """URL that redirects to a different domain reports redirected=True."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )

        with respx.mock:
            respx.head("https://api.legit.com/success").respond(
                302, headers={"Location": "https://porn-site.com/landing"}
            )
            respx.head("https://porn-site.com/landing").respond(200)
            results = await resolve_url_redirects(["https://api.legit.com/success"])

        assert len(results) == 1
        assert results[0].redirected is True
        assert results[0].final_domain == "porn-site.com"
        assert results[0].final_url == "https://porn-site.com/landing"

    @pytest.mark.asyncio
    async def test_same_domain_redirect(self, mocker: MockerFixture) -> None:
        """URL that redirects within the same domain reports redirected=False."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://example.com/old",
                final_url="https://example.com/new",
                final_domain="example.com",
                redirected=False,
            ),
        )

        with respx.mock:
            respx.head("https://example.com/old").respond(
                301, headers={"Location": "https://example.com/new"}
            )
            respx.head("https://example.com/new").respond(200)
            results = await resolve_url_redirects(["https://example.com/old"])

        assert len(results) == 1
        assert results[0].redirected is False

    @pytest.mark.asyncio
    async def test_www_redirect_not_flagged(self, mocker: MockerFixture) -> None:
        """Redirect from bare domain to www (or vice versa) is not flagged."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://example.com/thanks",
                final_url="https://www.example.com/thanks",
                final_domain="www.example.com",
                redirected=False,
            ),
        )

        with respx.mock:
            respx.head("https://example.com/thanks").respond(
                301, headers={"Location": "https://www.example.com/thanks"}
            )
            respx.head("https://www.example.com/thanks").respond(200)
            results = await resolve_url_redirects(["https://example.com/thanks"])

        assert len(results) == 1
        assert results[0].redirected is False
        assert results[0].final_domain == "www.example.com"

    @pytest.mark.asyncio
    async def test_www_to_bare_redirect_not_flagged(
        self, mocker: MockerFixture
    ) -> None:
        """Redirect from www to bare domain is not flagged."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://www.example.com/thanks",
                final_url="https://example.com/thanks",
                final_domain="example.com",
                redirected=False,
            ),
        )

        with respx.mock:
            respx.head("https://www.example.com/thanks").respond(
                301, headers={"Location": "https://example.com/thanks"}
            )
            respx.head("https://example.com/thanks").respond(200)
            results = await resolve_url_redirects(["https://www.example.com/thanks"])

        assert len(results) == 1
        assert results[0].redirected is False
        assert results[0].final_domain == "example.com"

    @pytest.mark.asyncio
    async def test_timeout_error(self, mocker: MockerFixture) -> None:
        """Timeout is reported as an error, not a crash."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )

        with respx.mock:
            respx.head("https://slow.com/timeout").mock(
                side_effect=Exception("timeout")
            )
            results = await resolve_url_redirects(["https://slow.com/timeout"])

        assert len(results) == 1
        assert results[0].error is not None
        assert results[0].redirected is False

    @pytest.mark.asyncio
    async def test_client_side_redirect_detected_by_browser(
        self, mocker: MockerFixture
    ) -> None:
        """URL returning 200 with a JS/meta-refresh redirect is caught by browser pass."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        # HEAD returns 200 (no HTTP redirect) — browser pass will be triggered
        # Browser detects the client-side redirect to a different domain
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://legit-api.com/success",
                final_url="https://scam-site.com/landing",
                final_domain="scam-site.com",
                redirected=True,
            ),
        )

        with respx.mock:
            respx.head("https://legit-api.com/success").respond(200)
            results = await resolve_url_redirects(["https://legit-api.com/success"])

        assert len(results) == 1
        assert results[0].redirected is True
        assert results[0].final_domain == "scam-site.com"
        assert results[0].final_url == "https://scam-site.com/landing"

    @pytest.mark.asyncio
    async def test_browser_error_does_not_crash(self, mocker: MockerFixture) -> None:
        """Browser errors are reported gracefully, not propagated."""
        import respx

        mocker.patch(
            "polar.organization_review.collectors.setup._validate_url_host",
            return_value=None,
        )
        mocker.patch(
            "polar.organization_review.collectors.setup._resolve_redirect_with_browser",
            return_value=UrlRedirectInfo(
                original_url="https://flaky-site.com/page",
                error="browser_error",
            ),
        )

        with respx.mock:
            respx.head("https://flaky-site.com/page").respond(200)
            results = await resolve_url_redirects(["https://flaky-site.com/page"])

        assert len(results) == 1
        assert results[0].error == "browser_error"
        assert results[0].redirected is False
