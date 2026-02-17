import asyncio
from dataclasses import dataclass, field
from urllib.parse import urlparse

import structlog
from playwright.async_api import Page, async_playwright
from pydantic_ai import Agent, RunContext
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

from polar.config import settings

from ..schemas import WebsiteData, WebsitePage

log = structlog.get_logger(__name__)

OVERALL_TIMEOUT_S = 90
MAX_PAGES = 5
MAX_CHARS_PER_PAGE = 3_000
PAGE_TIMEOUT_MS = 10_000

# JS: extract text content preferring <main> over <body>,
# preserving heading/list structure as markdown-like text.
EXTRACT_CONTENT_JS = """
() => {
    const root = document.querySelector('main') || document.body;
    if (!root) return '';

    const blocks = [];
    const walk = (node) => {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent.trim();
            if (text) blocks.push(text);
            return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const tag = node.tagName.toLowerCase();

        if (['script', 'style', 'noscript', 'svg', 'iframe'].includes(tag)) return;
        if (root === document.body && ['nav', 'footer', 'header'].includes(tag)) return;

        if (/^h[1-6]$/.test(tag)) {
            const level = parseInt(tag[1]);
            const text = node.textContent.trim();
            if (text) blocks.push('\\n' + '#'.repeat(level) + ' ' + text + '\\n');
            return;
        }
        if (tag === 'li') {
            const text = node.textContent.trim();
            if (text) blocks.push('- ' + text);
            return;
        }
        if (['p', 'div', 'section', 'article'].includes(tag)) {
            for (const child of node.childNodes) walk(child);
            blocks.push('');
            return;
        }
        for (const child of node.childNodes) walk(child);
    };
    walk(root);

    return blocks
        .join('\\n')
        .replace(/\\n{3,}/g, '\\n\\n')
        .trim();
}
"""

# JS: extract internal nav/header/footer links as "text -> href" pairs.
EXTRACT_LINKS_JS = """
() => {
    const selectors = ['nav a', 'header a', 'footer a'];
    const results = [];
    const seen = new Set();
    for (const sel of selectors) {
        for (const a of document.querySelectorAll(sel)) {
            const href = a.href;
            const text = a.textContent.trim();
            if (href && !seen.has(href) && text) {
                seen.add(href);
                results.push(text + ' -> ' + href);
            }
        }
    }
    return results.slice(0, 20);
}
"""

SYSTEM_PROMPT = """\
You are a website analyst for a business compliance review. You have a browser tool to \
navigate and read web pages. Your job is to explore the site and produce a concise summary.

## Instructions

1. Use the `visit_page` tool with the homepage URL provided in the user message.
2. Based on the content and links returned, decide which pages are most relevant \
(pricing, about, products, features, FAQ).
3. Visit up to 5 pages total. Stop early if you have enough information.
4. After exploring, produce your final summary as your response.

## Summary format

Your final response must cover:
- **Business description**: What the company does, core product/service
- **Products & pricing**: What they sell and at what price points (if visible)
- **Target audience**: Who the product is for
- **Red flags**: Anything suspicious — placeholder content, mismatched claims, \
prohibited content, signs the site is fake/misleading, or empty pages

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
available navigation links. Only same-domain URLs are allowed. Max 5 pages."""
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

    # Extract content
    try:
        content = await deps.page.evaluate(EXTRACT_CONTENT_JS)
    except Exception:
        content = ""

    title = await deps.page.title() or None
    current_url = deps.page.url

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

    # Extract links
    try:
        links = await deps.page.evaluate(EXTRACT_LINKS_JS)
    except Exception:
        links = []

    # Build combined response
    parts: list[str] = []
    parts.append(f"Page: {title or 'Untitled'} ({current_url})")
    parts.append(f"Pages visited: {deps.pages_navigated}/{MAX_PAGES}")
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

    parsed = urlparse(base_url)
    result = WebsiteData(base_url=base_url)

    try:
        summary, pages = await asyncio.wait_for(
            _run_browser_agent(base_url, parsed.netloc),
            timeout=OVERALL_TIMEOUT_S,
        )
        result.pages = pages
        result.total_pages_succeeded = len(pages)
        result.summary = summary
    except TimeoutError:
        log.warning(
            "website_collector.overall_timeout",
            url=base_url,
            timeout=OVERALL_TIMEOUT_S,
        )
        result.scrape_error = f"Overall timeout after {OVERALL_TIMEOUT_S}s"
    except Exception as e:
        log.warning("website_collector.failed", url=base_url, error=str(e))
        result.scrape_error = str(e)[:200]

    return result


async def _run_browser_agent(
    base_url: str, base_domain: str
) -> tuple[str, list[WebsitePage]]:
    """Launch browser, run the agent, return summary and visited pages."""
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

            return result.output, deps.pages_visited
        finally:
            await browser.close()
