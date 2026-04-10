import asyncio
from urllib.parse import urlparse

import httpx
import structlog
from playwright.async_api import async_playwright

from polar.kit.http import SSRFBlockedError, resolve_and_validate_ip
from polar.models.checkout_link import CheckoutLink
from polar.models.webhook_endpoint import WebhookEndpoint

from ..known_domains import match_known_domain
from ..schemas import (
    CheckoutLinkBenefitData,
    CheckoutLinksData,
    CheckoutReturnUrlData,
    CheckoutSuccessUrlData,
    IntegrationData,
    SetupData,
    UrlRedirectInfo,
    WebhookEndpointData,
)

log = structlog.get_logger(__name__)

# Timeout for following redirects on a single URL
_REDIRECT_TIMEOUT = 5.0
# Maximum number of URLs to resolve redirects for
_MAX_URLS_TO_RESOLVE = 20
# Maximum concurrent redirect resolutions
_MAX_CONCURRENT = 5
# Timeout for Playwright page navigation (ms)
_BROWSER_PAGE_TIMEOUT_MS = 10_000


def _extract_domain(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        return parsed.netloc or None
    except Exception:
        return None


def _normalize_domain(domain: str) -> str:
    """Strip leading 'www.' so that bare and www variants are treated as the same domain."""
    return domain.removeprefix("www.")


def _is_cross_domain(original: str | None, final: str | None) -> bool:
    """Return True if two domains differ after www-normalization.

    Returns False if either domain is None (unparseable URLs are not
    treated as cross-domain redirects — they surface via the error field).
    """
    if original is None or final is None:
        return False
    return _normalize_domain(original) != _normalize_domain(final)


def _unique_domains(urls: list[str]) -> list[str]:
    """Extract and deduplicate domains from a list of URLs, preserving order."""
    seen: set[str] = set()
    result: list[str] = []
    for url in urls:
        domain = _extract_domain(url)
        if domain and domain not in seen:
            seen.add(domain)
            result.append(domain)
    return result


def _validate_url_scheme(url: str) -> None:
    """Raise ValueError if the URL scheme is not http or https."""
    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        raise ValueError(f"invalid scheme: {parsed.scheme}")


async def _validate_url_host(url: str) -> None:
    """Validate that the URL host does not resolve to a private/reserved IP."""
    parsed = urlparse(url)
    hostname = parsed.hostname
    if hostname:
        await resolve_and_validate_ip(hostname)


async def _resolve_redirect(
    client: httpx.AsyncClient,
    semaphore: asyncio.Semaphore,
    url: str,
) -> UrlRedirectInfo:
    """Follow redirects on a URL and return where it ultimately lands.

    Validates scheme and checks for SSRF before making the request.
    Uses a manual redirect loop to validate each hop against private IPs.
    """
    try:
        _validate_url_scheme(url)
        await _validate_url_host(url)
    except (ValueError, SSRFBlockedError):
        return UrlRedirectInfo(original_url=url, error="blocked")

    async with semaphore:
        try:
            # Use manual redirect loop so we can validate each hop
            current_url = url
            for _ in range(10):  # max redirect hops
                response = await client.head(current_url)
                if response.is_redirect and response.has_redirect_location:
                    next_url = str(response.headers["location"])
                    # Resolve relative redirects
                    if not next_url.startswith(("http://", "https://")):
                        next_url = str(response.url.join(next_url))
                    # Validate next hop
                    try:
                        _validate_url_scheme(next_url)
                        await _validate_url_host(next_url)
                    except (ValueError, SSRFBlockedError):
                        return UrlRedirectInfo(
                            original_url=url, error="redirect_blocked"
                        )
                    current_url = next_url
                else:
                    break

            final_url = str(response.url)
            final_domain = _extract_domain(final_url)
            original_domain = _extract_domain(url)
            redirected = _is_cross_domain(original_domain, final_domain)
            return UrlRedirectInfo(
                original_url=url,
                final_url=final_url,
                final_domain=final_domain,
                redirected=redirected,
            )
        except httpx.TimeoutException:
            return UrlRedirectInfo(original_url=url, error="timeout")
        except SSRFBlockedError:
            return UrlRedirectInfo(original_url=url, error="blocked")
        except Exception:
            return UrlRedirectInfo(original_url=url, error="connection_error")


def _pick_one_per_hostname(urls: list[str]) -> list[str]:
    """Pick one URL per unique hostname — no need to check every URL on the same host."""
    seen: set[str | None] = set()
    result: list[str] = []
    for url in urls:
        hostname = urlparse(url).hostname
        if hostname not in seen:
            seen.add(hostname)
            result.append(url)
    return result


async def _resolve_redirect_with_browser(url: str) -> UrlRedirectInfo:
    """Use a headless browser to detect client-side redirects (meta refresh, JS).

    Launches a fresh Playwright browser, navigates to the URL, waits for
    any client-side redirects to settle, then compares the final domain.
    """
    try:
        _validate_url_scheme(url)
        await _validate_url_host(url)
    except (ValueError, SSRFBlockedError):
        return UrlRedirectInfo(original_url=url, error="blocked")

    pw = None
    browser = None
    try:
        pw = await async_playwright().start()
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent=(
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/131.0.0.0 Safari/537.36"
            ),
            java_script_enabled=True,
        )
        page = await context.new_page()

        # Install SSRF-only interceptor (allow cross-origin — we want to detect it)
        async def _ssrf_handler(route):  # type: ignore[no-untyped-def]
            parsed = urlparse(route.request.url)
            if parsed.scheme in ("data", "blob"):
                await route.continue_()
                return
            hostname = parsed.hostname
            if hostname:
                try:
                    await resolve_and_validate_ip(hostname)
                except SSRFBlockedError:
                    await route.abort("blockedbyclient")
                    return
            await route.continue_()

        await page.route("**/*", _ssrf_handler)

        await page.goto(
            url,
            timeout=_BROWSER_PAGE_TIMEOUT_MS,
            wait_until="domcontentloaded",
        )
        # Wait for JS / meta-refresh redirects to settle
        try:
            await page.wait_for_load_state("networkidle", timeout=5_000)
        except Exception:
            pass  # best-effort
        await page.wait_for_timeout(1_000)

        final_url = page.url
        final_domain = _extract_domain(final_url)
        original_domain = _extract_domain(url)
        redirected = _is_cross_domain(original_domain, final_domain)

        return UrlRedirectInfo(
            original_url=url,
            final_url=final_url,
            final_domain=final_domain,
            redirected=redirected,
        )
    except Exception:
        log.warning("setup_collector.browser_redirect_error", url=url, exc_info=True)
        return UrlRedirectInfo(original_url=url, error="browser_error")
    finally:
        if browser:
            try:
                await browser.close()
            except Exception:
                pass
        if pw:
            try:
                await pw.stop()
            except Exception:
                pass


async def resolve_url_redirects(urls: list[str]) -> list[UrlRedirectInfo]:
    """Follow redirects for a sample of URLs (one per hostname).

    Uses a two-pass approach:
    1. Fast HEAD requests to detect HTTP-level redirects (301/302).
    2. For URLs that returned 200 (no HTTP redirect), a headless browser
       check to detect client-side redirects (meta refresh, JS).
    """
    if not urls:
        return []

    urls_to_check = _pick_one_per_hostname(urls)[:_MAX_URLS_TO_RESOLVE]
    semaphore = asyncio.Semaphore(_MAX_CONCURRENT)

    # Pass 1: HEAD requests (fast)
    async with httpx.AsyncClient(
        follow_redirects=False,  # We follow manually to validate each hop
        timeout=_REDIRECT_TIMEOUT,
        headers={"User-Agent": "Mozilla/5.0 (compatible; PolarReviewBot/1.0)"},
    ) as client:
        results = list(
            await asyncio.gather(
                *[_resolve_redirect(client, semaphore, url) for url in urls_to_check]
            )
        )

    # Pass 2: browser check for URLs that HEAD didn't detect as redirected
    needs_browser = [r for r in results if not r.redirected and r.error is None]
    if needs_browser:
        result_map = {r.original_url: r for r in results}
        for info in needs_browser:
            browser_result = await _resolve_redirect_with_browser(info.original_url)
            if browser_result.redirected or browser_result.error:
                result_map[info.original_url] = browser_result
        results = [result_map[url] for url in urls_to_check if url in result_map]

    redirected = [r for r in results if r.redirected]
    if redirected:
        log.warning(
            "setup_collector.redirects_detected",
            count=len(redirected),
            urls=[(r.original_url, r.final_url) for r in redirected],
        )

    return results


def collect_setup_data(
    checkout_links: list[CheckoutLink],
    checkout_return_urls: list[str],
    checkout_success_urls: list[str],
    api_key_count: int,
    webhook_endpoints: list[WebhookEndpoint],
    *,
    success_url_redirects: list[UrlRedirectInfo] | None = None,
    return_url_redirects: list[UrlRedirectInfo] | None = None,
) -> SetupData:
    # Checkout success URLs — merge from both CheckoutLink and Checkout sources
    unique_urls: list[str] = []
    seen_urls: set[str] = set()
    for link in checkout_links:
        if link.success_url and link.success_url not in seen_urls:
            seen_urls.add(link.success_url)
            unique_urls.append(link.success_url)
    for url in checkout_success_urls:
        if url not in seen_urls:
            seen_urls.add(url)
            unique_urls.append(url)

    success_url_data = CheckoutSuccessUrlData(
        unique_urls=unique_urls,
        domains=_unique_domains(unique_urls),
        redirect_results=success_url_redirects or [],
    )

    # Checkout return URLs (from the checkouts table, API-created)
    return_url_data = CheckoutReturnUrlData(
        unique_urls=checkout_return_urls,
        domains=_unique_domains(checkout_return_urls),
        redirect_results=return_url_redirects or [],
    )

    # Checkout links with benefit info
    link_data_list: list[CheckoutLinkBenefitData] = []
    links_without_benefits = 0
    for link in checkout_links:
        product_names: list[str] = []
        has_benefits = False
        for clp in link.checkout_link_products:
            product = clp.product
            product_names.append(product.name)
            if product.product_benefits:
                has_benefits = True

        if not has_benefits:
            links_without_benefits += 1

        link_data_list.append(
            CheckoutLinkBenefitData(
                label=str(link.label) if link.label else None,
                product_names=product_names,
                has_benefits=has_benefits,
            )
        )

    checkout_links_data = CheckoutLinksData(
        total_links=len(checkout_links),
        links_without_benefits=links_without_benefits,
        links=link_data_list,
    )

    # Integration data
    webhook_endpoint_data = [
        WebhookEndpointData(url=ep.url, enabled=ep.enabled) for ep in webhook_endpoints
    ]
    webhook_urls = [ep.url for ep in webhook_endpoints]
    webhook_domains = _unique_domains(webhook_urls)

    integration_data = IntegrationData(
        api_key_count=api_key_count,
        webhook_endpoints=webhook_endpoint_data,
        webhook_domains=webhook_domains,
        webhook_known_service_domains=[
            d for d in webhook_domains if match_known_domain(d) is not None
        ],
    )

    return SetupData(
        checkout_success_urls=success_url_data,
        checkout_return_urls=return_url_data,
        checkout_links=checkout_links_data,
        integration=integration_data,
    )
