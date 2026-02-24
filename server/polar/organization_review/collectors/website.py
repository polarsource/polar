from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from urllib.parse import urlparse

import structlog
import trafilatura
from playwright.async_api import Page, async_playwright
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings

from ..schemas import UsageInfo, WebsiteData, WebsitePage

log = structlog.get_logger(__name__)

OVERALL_TIMEOUT_S = 90
MAX_PAGES = 5
MAX_CHARS_PER_PAGE = 3_000
PAGE_TIMEOUT_MS = 10_000

# JS: extract internal links from navigation areas, CTAs, and main content.
_EXTRACT_LINKS_JS = """
() => {
    const results = [];
    const seen = new Set();

    function addLink(a) {
        const href = a.href;
        const text = (a.textContent || '').trim().substring(0, 80);
        if (href && !seen.has(href) && text && !href.startsWith('javascript:')) {
            seen.add(href);
            results.push(text + ' -> ' + href);
        }
    }

    // Nav, header, footer, sidebar, ARIA navigation
    const navSelectors = [
        'nav a', 'header a', 'footer a', 'aside a',
        '[role="navigation"] a', '[role="menu"] a', '[role="menubar"] a',
    ];
    for (const sel of navSelectors) {
        for (const a of document.querySelectorAll(sel)) addLink(a);
    }

    // CTA-style links in main content
    for (const a of document.querySelectorAll('main a, [role="main"] a, #content a, .content a')) {
        addLink(a);
    }

    // Remaining top-level links
    for (const a of document.querySelectorAll('a[href]')) {
        if (results.length >= 40) break;
        addLink(a);
    }

    return results.slice(0, 40);
}
"""

# JS: extract meta description, Open Graph tags, and JSON-LD structured data.
_EXTRACT_METADATA_JS = """
() => {
    const result = {};

    const desc = document.querySelector('meta[name="description"]');
    if (desc) result.description = (desc.content || '').substring(0, 300);

    const ogTags = {};
    for (const meta of document.querySelectorAll('meta[property^="og:"]')) {
        const key = meta.getAttribute('property').replace('og:', '');
        if (['title', 'description', 'type', 'site_name'].includes(key)) {
            ogTags[key] = (meta.content || '').substring(0, 200);
        }
    }
    if (Object.keys(ogTags).length > 0) result.og = ogTags;

    const jsonld = document.querySelector('script[type="application/ld+json"]');
    if (jsonld) {
        try {
            const data = JSON.parse(jsonld.textContent);
            result.jsonld = JSON.stringify(data).substring(0, 1000);
        } catch {}
    }

    return result;
}
"""

SYSTEM_PROMPT = """\
You are a website analyst for a business compliance review. You have a browser tool to \
navigate and read web pages. Your job is to explore the site and produce a concise summary.

## Instructions

1. Use the `visit_page` tool with the homepage URL provided in the user message.
2. Based on the extracted content, metadata, and available links, decide which pages are \
most relevant (pricing, about, products, features, FAQ).
3. Visit up to 5 pages total. Stop early if you have enough information.
4. After exploring, produce your final summary as your response.

## Summary format

Your final response must cover:
- **Business description**: What the company does, core product/service
- **Products & pricing**: What they sell and at what price points (if visible)
- **Target audience**: Who the product is for

Keep it factual and under 500 words. Skip sections with no relevant info.
"""


@dataclass
class BrowserDeps:
    """Dependencies injected into the agent — holds browser state."""

    page: Page
    base_domain: str
    pages_visited: list[WebsitePage] = field(default_factory=list)
    pages_navigated: int = 0


# --- Module-level singleton agent ---

_provider = OpenAIProvider(api_key=settings.OPENAI_API_KEY)
_model = OpenAIChatModel(settings.OPENAI_MODEL, provider=_provider)
_website_agent: Agent[BrowserDeps, str] = Agent(
    _model,
    output_type=str,
    deps_type=BrowserDeps,
    system_prompt=SYSTEM_PROMPT,
    retries=0,
)


@_website_agent.tool
async def visit_page(ctx: RunContext[BrowserDeps], url: str) -> str:
    """Navigate to a URL, extract the main text content, and return it along with \
page metadata and available navigation links. Only same-domain URLs are allowed. \
Max 5 pages."""
    deps = ctx.deps
    if deps.pages_navigated >= MAX_PAGES:
        return "Page limit reached. Produce your summary now."

    parsed = urlparse(url)
    if parsed.netloc and parsed.netloc != deps.base_domain:
        return f"Error: Cannot visit external domain {parsed.netloc}."

    try:
        response = await deps.page.goto(
            url, timeout=PAGE_TIMEOUT_MS, wait_until="domcontentloaded"
        )
        if response and response.status >= 400:
            return f"Error: HTTP {response.status} for {url}"
    except Exception as e:
        return f"Error navigating to {url}: {str(e)[:100]}"

    deps.pages_navigated += 1

    # Brief wait for JS rendering
    await deps.page.wait_for_timeout(1_000)

    # Extract content via trafilatura
    try:
        html = await deps.page.content()
        content = trafilatura.extract(html, output_format="markdown") or ""
    except Exception:
        content = ""

    title = await deps.page.title() or None
    current_url = deps.page.url

    # Extract page metadata (meta description, OG tags, JSON-LD)
    try:
        metadata = await deps.page.evaluate(_EXTRACT_METADATA_JS)
    except Exception:
        metadata = {}

    truncated = len(content) > MAX_CHARS_PER_PAGE
    if truncated:
        content = content[:MAX_CHARS_PER_PAGE]

    deps.pages_visited.append(
        WebsitePage(
            url=current_url,
            title=title,
            content=content,
            content_truncated=truncated,
        )
    )

    # Extract links for the agent to choose from
    try:
        links = await deps.page.evaluate(_EXTRACT_LINKS_JS)
    except Exception:
        links = []

    # Build response
    parts: list[str] = []
    parts.append(f"Page: {title or 'Untitled'} ({current_url})")
    parts.append(f"Pages visited: {deps.pages_navigated}/{MAX_PAGES}")

    if metadata.get("description"):
        parts.append(f"Meta description: {metadata['description']}")
    if metadata.get("og"):
        og = metadata["og"]
        og_parts = [f"{k}: {v}" for k, v in og.items() if v]
        if og_parts:
            parts.append(f"Open Graph: {'; '.join(og_parts)}")
    if metadata.get("jsonld"):
        parts.append(f"Structured data: {metadata['jsonld']}")

    parts.append("")
    parts.append(content if content else "(empty page)")
    if truncated:
        parts.append("(content truncated)")
    if links:
        parts.append("")
        parts.append("Links:")
        parts.append("\n".join(links))

    return "\n".join(parts)


async def collect_website_data(website_url: str) -> WebsiteData:
    """Use an AI agent with browser tools to explore and summarize a website."""
    base_url = website_url.rstrip("/")
    if not base_url.startswith(("http://", "https://")):
        base_url = "https://" + base_url

    try:
        return await asyncio.wait_for(
            _run_browser_agent(base_url, urlparse(base_url).netloc),
            timeout=OVERALL_TIMEOUT_S,
        )
    except TimeoutError:
        log.warning(
            "website_collector.overall_timeout",
            url=base_url,
            timeout=OVERALL_TIMEOUT_S,
        )
        return WebsiteData(
            base_url=base_url,
            scrape_error=f"Overall timeout after {OVERALL_TIMEOUT_S}s",
        )
    except Exception as e:
        log.warning("website_collector.failed", url=base_url, error=str(e))
        return WebsiteData(base_url=base_url, scrape_error=str(e)[:200])


async def _run_browser_agent(base_url: str, base_domain: str) -> WebsiteData:
    """Launch browser, run the agent, return website data with usage."""
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        try:
            context = await browser.new_context(
                user_agent="PolarBot/1.0 (+https://polar.sh)",
                java_script_enabled=True,
            )
            await context.route(
                "**/*",
                lambda route: (
                    route.abort()
                    if route.request.resource_type
                    in ("image", "font", "media", "stylesheet")
                    else route.continue_()
                ),
            )
            page = await context.new_page()

            deps = BrowserDeps(page=page, base_domain=base_domain)

            result = await _website_agent.run(
                f"Analyze the website at: {base_url}",
                deps=deps,
            )

            return WebsiteData(
                base_url=base_url,
                pages=deps.pages_visited,
                summary=result.output,
                total_pages_attempted=max(len(deps.pages_visited), 1),
                total_pages_succeeded=len(deps.pages_visited),
                usage=UsageInfo.from_agent_usage(result.usage(), _model.model_name),
            )
        finally:
            await browser.close()
