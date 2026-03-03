from urllib.parse import urlparse

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
)


def _extract_domain(url: str) -> str | None:
    try:
        parsed = urlparse(url)
        return parsed.netloc or None
    except Exception:
        return None


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


def collect_setup_data(
    checkout_links: list[CheckoutLink],
    checkout_return_urls: list[str],
    api_key_count: int,
    webhook_endpoints: list[WebhookEndpoint],
) -> SetupData:
    # Checkout success URLs
    unique_urls: list[str] = []
    seen_urls: set[str] = set()
    for link in checkout_links:
        if link.success_url and link.success_url not in seen_urls:
            seen_urls.add(link.success_url)
            unique_urls.append(link.success_url)

    success_url_data = CheckoutSuccessUrlData(
        unique_urls=unique_urls,
        domains=_unique_domains(unique_urls),
    )

    # Checkout return URLs (from the checkouts table, API-created)
    return_url_data = CheckoutReturnUrlData(
        unique_urls=checkout_return_urls,
        domains=_unique_domains(checkout_return_urls),
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
    webhook_urls = [ep.url for ep in webhook_endpoints]
    webhook_domains = _unique_domains(webhook_urls)

    integration_data = IntegrationData(
        api_key_count=api_key_count,
        webhook_urls=webhook_urls,
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
