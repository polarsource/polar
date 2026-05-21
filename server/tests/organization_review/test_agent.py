from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest

from polar.organization_review.agent import (
    _collect_webhook_host,
    _pick_unknown_webhook_host,
    _same_registrable_domain,
)
from polar.organization_review.schemas import (
    IntegrationData,
    SetupData,
    WebsiteData,
)


def _make_org(website: str | None) -> MagicMock:
    org = MagicMock()
    org.id = uuid4()
    org.slug = "test-org"
    org.website = website
    return org


def _make_setup(
    webhook_domains: list[str], known_service_domains: list[str] | None = None
) -> SetupData:
    return SetupData(
        integration=IntegrationData(
            webhook_domains=webhook_domains,
            webhook_known_service_domains=known_service_domains or [],
        )
    )


class TestSameRegistrableDomain:
    def test_exact_match(self) -> None:
        assert _same_registrable_domain("example.com", "example.com") is True

    def test_strips_www_on_both_sides(self) -> None:
        assert _same_registrable_domain("www.example.com", "example.com") is True
        assert _same_registrable_domain("example.com", "www.example.com") is True

    def test_subdomain_is_same(self) -> None:
        assert _same_registrable_domain("api.example.com", "example.com") is True
        assert _same_registrable_domain("example.com", "api.example.com") is True

    def test_deep_subdomain_is_same(self) -> None:
        assert _same_registrable_domain("a.b.c.example.com", "example.com") is True

    def test_different_domains(self) -> None:
        assert _same_registrable_domain("example.com", "other.com") is False

    def test_suffix_lookalike_rejected(self) -> None:
        """notexample.com must not match example.com — dot anchoring required."""
        assert _same_registrable_domain("notexample.com", "example.com") is False
        assert _same_registrable_domain("example.com", "notexample.com") is False

    def test_cctld_safe(self) -> None:
        """Suffix matching must not collapse multi-part TLDs."""
        # foo.co.uk and bar.co.uk are different orgs even though both end in .co.uk
        assert _same_registrable_domain("foo.co.uk", "bar.co.uk") is False
        # but app.foo.co.uk and foo.co.uk are the same org
        assert _same_registrable_domain("app.foo.co.uk", "foo.co.uk") is True

    def test_case_insensitive(self) -> None:
        assert _same_registrable_domain("Example.COM", "example.com") is True

    def test_empty_inputs(self) -> None:
        assert _same_registrable_domain("", "example.com") is False
        assert _same_registrable_domain("example.com", "") is False


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
    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
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

    @pytest.mark.asyncio
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
