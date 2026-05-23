"""Website lane: scrapes the merchant site + reads it via a sandboxed Reader.

Two concerns:

* ``REDIRECT_TO_OTHER_DOMAIN`` (HIGH, policy) — deterministic: the
  declared website resolves to a different registrable domain than
  declared. Often a sign the merchant is fronting another business.
* Sandboxed read — merchant HTML goes through :class:`WebsiteReader`
  (a Reader subclass), whose cues land in ``state.reader_cues`` for
  Decide. Raw HTML never leaves the lane.

The fetch is injectable (``fetch_fn``) so tests run without network;
production uses the legacy ``collect_website_data`` collector. Reader
model is injectable too (TestModel in tests, gateway in prod).
"""

from __future__ import annotations

from collections.abc import Awaitable, Callable
from typing import ClassVar
from urllib.parse import urlparse

import structlog

from ..readers.website import WebsiteReader
from ..schemas import LaneFacts, RaisedSignal, Severity, SignalKind
from .base import LaneRunContext, LaneRunResult

log = structlog.get_logger(__name__)


# (text_for_reader, final_url, scrape_error)
FetchResult = tuple[str, str | None, str | None]
FetchFn = Callable[[str], Awaitable[FetchResult]]


async def _default_fetch(website: str) -> FetchResult:
    """Production fetch via the legacy website collector."""

    from polar.organization_review.collectors.website import (
        collect_website_data,
    )

    data = await collect_website_data(website)
    text = data.summary or "\n\n".join(
        p.content for p in data.pages if p.content
    )
    final_url = data.pages[0].url if data.pages else None
    return text, final_url, data.scrape_error


def _registrable(url: str | None) -> str | None:
    if not url:
        return None
    netloc = urlparse(url if "://" in url else f"https://{url}").netloc.lower()
    host = netloc.split("@")[-1].split(":")[0]
    parts = host.split(".")
    return ".".join(parts[-2:]) if len(parts) >= 2 else host or None


class WebsiteLane:
    name: ClassVar[str] = "website"

    def __init__(
        self,
        *,
        fetch_fn: FetchFn | None = None,
        reader_model: object | None = None,
    ) -> None:
        self._fetch_fn = fetch_fn or _default_fetch
        self._reader_model = reader_model

    async def is_enabled(self, ctx: LaneRunContext) -> bool:
        return bool(ctx.organization.website)

    async def run(self, ctx: LaneRunContext) -> LaneRunResult:
        website = ctx.organization.website or ""
        signals: list[RaisedSignal] = []
        payload: dict[str, object] = {"website": website}

        try:
            text, final_url, scrape_error = await self._fetch_fn(website)
        except Exception:
            log.warning(
                "organization_review_agent.website.fetch_failed",
                website=website,
                exc_info=True,
            )
            return LaneRunResult(
                facts=LaneFacts(
                    name=self.name,
                    payload={**payload, "fetch_failed": True},
                ),
                signals=[],
            )

        payload["scrape_error"] = scrape_error
        payload["final_url"] = final_url

        # Deterministic redirect-to-other-domain signal.
        declared = _registrable(website)
        resolved = _registrable(final_url)
        if declared and resolved and declared != resolved:
            signals.append(
                RaisedSignal(
                    kind=SignalKind.REDIRECT_TO_OTHER_DOMAIN,
                    severity=Severity.HIGH,
                    summary=(
                        f"Declared website {declared} resolves to a "
                        f"different domain {resolved}."
                    ),
                    evidence={
                        "declared_domain": declared,
                        "resolved_domain": resolved,
                        "final_url": final_url,
                    },
                )
            )

        # Sandboxed read of the (untrusted) page text → cues for Decide.
        cues = None
        if text and not scrape_error:
            try:
                reader = WebsiteReader(model=self._reader_model)
                cue = await reader.read(text)
                cues = {
                    "source": cue.source,
                    "summary": cue.summary,
                    "tone": cue.tone,
                    "quoted_excerpts": cue.quoted_excerpts,
                }
            except Exception:
                log.warning(
                    "organization_review_agent.website.reader_failed",
                    website=website,
                    exc_info=True,
                )
        payload["reader_cues"] = cues

        return LaneRunResult(
            facts=LaneFacts(name=self.name, payload=payload),
            signals=signals,
        )


website_lane = WebsiteLane()


__all__ = ["WebsiteLane", "website_lane"]
