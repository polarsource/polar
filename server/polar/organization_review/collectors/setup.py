from urllib.parse import urlparse

from polar.models.checkout_link import CheckoutLink
from polar.models.webhook_endpoint import WebhookEndpoint

from ..schemas import (
    CheckoutLinkBenefitData,
    CheckoutLinksData,
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


def collect_setup_data(
    checkout_links: list[CheckoutLink],
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

    url_domains = []
    seen_domains: set[str] = set()
    for url in unique_urls:
        domain = _extract_domain(url)
        if domain and domain not in seen_domains:
            seen_domains.add(domain)
            url_domains.append(domain)

    success_url_data = CheckoutSuccessUrlData(
        unique_urls=unique_urls,
        domains=url_domains,
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
    webhook_domains: list[str] = []
    seen_wh_domains: set[str] = set()
    for url in webhook_urls:
        domain = _extract_domain(url)
        if domain and domain not in seen_wh_domains:
            seen_wh_domains.add(domain)
            webhook_domains.append(domain)

    integration_data = IntegrationData(
        api_key_count=api_key_count,
        webhook_urls=webhook_urls,
        webhook_domains=webhook_domains,
    )

    return SetupData(
        checkout_success_urls=success_url_data,
        checkout_links=checkout_links_data,
        integration=integration_data,
    )
