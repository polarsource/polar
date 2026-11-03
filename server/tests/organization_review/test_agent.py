from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from polar.kit.http import SSRFBlockedError
from polar.organization_review.agent import (
    _MAX_CHECKOUT_URL_HOST_CANDIDATES,
    MAX_CHECKOUT_URL_HOSTS,
    _collect_checkout_url_hosts,
    _collect_webhook_host,
    _pick_checkout_url_hosts,
    _pick_unknown_webhook_host,
)
from polar.organization_review.schemas import (
    CheckoutReturnUrlData,
    CheckoutSuccessUrlData,
    IntegrationData,
    SetupData,
    UrlRedirectInfo,
    WebsiteData,
)


def _make_org(website: str | None) -> MagicMock:
    org = MagicMock()
    org.id = uuid4()
    org.slug = "test-org"
    org.website = website
    return org


def _make_setup(
    webhook_domains: list[str] | None = None,
    known_service_domains: list[str] | None = None,
    *,
    success_urls: list[str] | None = None,
    redirects: list[UrlRedirectInfo] | None = None,
    return_urls: list[str] | None = None,
) -> SetupData:
    return SetupData(
        checkout_success_urls=CheckoutSuccessUrlData(
            unique_urls=success_urls or [], redirect_results=redirects or []
        ),
        checkout_return_urls=CheckoutReturnUrlData(unique_urls=return_urls or []),
        integration=IntegrationData(
            webhook_domains=webhook_domains or [],
            webhook_known_service_domains=known_service_domains or [],
        ),
    )


class TestPickUnknownWebhookHost:
    def test_no_webhooks_returns_none(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=[])
        assert _pick_unknown_webhook_host(org, setup) is None

    def test_same_domain_as_website_skipped(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["example.com"])
        assert _pick_unknown_webhook_host(org, setup) is None

    def test_subdomain_of_website_skipped(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["api.example.com"])
        assert _pick_unknown_webhook_host(org, setup) is None

    def test_www_variant_skipped(self) -> None:
        org = _make_org("https://www.example.com")
        setup = _make_setup(webhook_domains=["example.com"])
        assert _pick_unknown_webhook_host(org, setup) is None

    def test_known_service_skipped(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            webhook_domains=["hooks.zapier.com"],
            known_service_domains=["hooks.zapier.com"],
        )
        assert _pick_unknown_webhook_host(org, setup) is None

    def test_unknown_different_domain_returned(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["api.different.com"])
        assert _pick_unknown_webhook_host(org, setup) == "api.different.com"

    def test_returns_first_unknown_when_multiple(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            webhook_domains=["example.com", "first-unknown.com", "second-unknown.com"]
        )
        assert _pick_unknown_webhook_host(org, setup) == "first-unknown.com"

    def test_missing_website_still_returns_webhook(self) -> None:
        """If the org has no declared website, every webhook is 'unknown'."""
        org = _make_org(None)
        setup = _make_setup(webhook_domains=["something.com"])
        assert _pick_unknown_webhook_host(org, setup) == "something.com"

    def test_known_service_match_is_case_insensitive(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            webhook_domains=["HOOKS.ZAPIER.COM"],
            known_service_domains=["hooks.zapier.com"],
        )
        assert _pick_unknown_webhook_host(org, setup) is None


class TestCollectWebhookHost:
    @pytest.mark.anyio
    async def test_returns_none_when_no_host_to_fetch(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["example.com"])  # same domain → skip
        with patch(
            "polar.organization_review.agent.collect_website_data",
            new_callable=AsyncMock,
        ) as fetch:
            result = await _collect_webhook_host(org, setup)
        assert result is None
        fetch.assert_not_awaited()

    @pytest.mark.anyio
    async def test_fetches_unknown_host(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["api.different.com"])
        data = WebsiteData(base_url="https://api.different.com/")
        with patch(
            "polar.organization_review.agent.collect_website_data",
            new=AsyncMock(return_value=data),
        ) as fetch:
            result = await _collect_webhook_host(org, setup)
        assert result is data
        fetch.assert_awaited_once_with(
            "https://api.different.com/",
            organization_id=str(org.id),
            organization_slug=org.slug,
        )

    @pytest.mark.anyio
    async def test_swallows_fetch_exception(self) -> None:
        """A scrape failure should not propagate — the review continues."""
        org = _make_org("https://example.com")
        setup = _make_setup(webhook_domains=["api.different.com"])
        with patch(
            "polar.organization_review.agent.collect_website_data",
            new=AsyncMock(side_effect=RuntimeError("network down")),
        ):
            result = await _collect_webhook_host(org, setup)
        assert result is None


class TestPickCheckoutUrlHosts:
    def test_skips_declared_website_domain(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(success_urls=["https://api.example.com/success"])
        assert _pick_checkout_url_hosts(org, setup) == []

    def test_picks_success_return_and_final_hosts_but_not_hops(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            success_urls=["https://api.example.com/success"],
            redirects=[
                UrlRedirectInfo(
                    original_url="https://api.example.com/success",
                    hops=["https://hop.com/"],
                    final_url="https://landing.com/",
                    redirected=True,
                )
            ],
            return_urls=["https://shop.other.com/back"],
        )
        assert _pick_checkout_url_hosts(org, setup) == [
            "landing.com",
            "shop.other.com",
        ]

    def test_skips_integration_services_but_keeps_hosting_platforms(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            success_urls=[
                "https://hooks.zapier.com/x",
                "https://store.lovable.app/thanks",
            ]
        )
        assert _pick_checkout_url_hosts(org, setup) == ["store.lovable.app"]

    def test_skips_fetched_webhook_host_and_duplicates(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            success_urls=[
                "https://hooks.store.com/success",
                "https://shop.com/a",
                "https://www.shop.com/b",
            ],
            webhook_domains=["store.com"],
        )
        assert _pick_checkout_url_hosts(org, setup) == ["shop.com"]

    def test_puts_redirect_destinations_first(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            success_urls=["https://site0.com/", "https://site1.com/"],
            redirects=[
                UrlRedirectInfo(
                    original_url="https://site1.com/",
                    final_url="https://landing.com/",
                    redirected=True,
                )
            ],
        )
        assert _pick_checkout_url_hosts(org, setup) == [
            "landing.com",
            "site0.com",
            "site1.com",
        ]


class TestCollectCheckoutUrlHosts:
    @pytest.mark.anyio
    async def test_fetches_each_host_and_drops_failures(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(success_urls=["https://good.com/", "https://broken.com/"])
        good = WebsiteData(base_url="https://good.com/")

        async def fake_collect(url: str, **kwargs: str) -> WebsiteData:
            if url == "https://broken.com/":
                raise RuntimeError("network down")
            return good

        with (
            patch("polar.organization_review.agent.resolve_and_validate_ip"),
            patch(
                "polar.organization_review.agent.collect_website_data",
                new=AsyncMock(side_effect=fake_collect),
            ),
        ):
            result = await _collect_checkout_url_hosts(org, setup)
        assert result == [good]

    @pytest.mark.anyio
    async def test_skips_private_hosts_before_applying_cap(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(
            success_urls=["https://internal.com/"]
            + [f"https://site{i}.com/" for i in range(MAX_CHECKOUT_URL_HOSTS + 1)]
        )

        async def fake_validate(host: str) -> None:
            if host == "internal.com":
                raise SSRFBlockedError("private")

        async def fake_collect(url: str, **kwargs: str) -> WebsiteData:
            return WebsiteData(base_url=url)

        with (
            patch(
                "polar.organization_review.agent.resolve_and_validate_ip",
                new=AsyncMock(side_effect=fake_validate),
            ),
            patch(
                "polar.organization_review.agent.collect_website_data",
                new=AsyncMock(side_effect=fake_collect),
            ),
        ):
            result = await _collect_checkout_url_hosts(org, setup)

        assert [r.base_url for r in result] == [
            f"https://site{i}.com/" for i in range(MAX_CHECKOUT_URL_HOSTS)
        ]

    @pytest.mark.anyio
    async def test_bounds_dns_lookups(self) -> None:
        org = _make_org("https://example.com")
        setup = _make_setup(success_urls=[f"https://site{i}.com/" for i in range(50)])

        with (
            patch(
                "polar.organization_review.agent.resolve_and_validate_ip",
                new=AsyncMock(side_effect=SSRFBlockedError("private")),
            ) as validate,
            patch(
                "polar.organization_review.agent.collect_website_data",
                new_callable=AsyncMock,
            ) as fetch,
        ):
            result = await _collect_checkout_url_hosts(org, setup)

        assert result == []
        assert validate.await_count == _MAX_CHECKOUT_URL_HOST_CANDIDATES
        fetch.assert_not_awaited()
