import asyncio
import json
import re
import time

import httpx
import structlog

from polar.config import settings

log = structlog.get_logger(__name__)

_DRIVE_EXPORT_URL = "https://www.googleapis.com/drive/v3/files/{file_id}/export"
_SCOPES = ["https://www.googleapis.com/auth/drive.readonly"]

# The policy document begins at this heading; everything above it in the source
# doc is authoring scaffolding (the "[Working Document]" banner, "How to read
# this", the TODO list, and the colour legend).
_START_MARKER = re.compile(r"^[#*\s]*Polar Acceptable Use Policy", re.IGNORECASE)
# Everything from this heading onward is an internal parking lot, not policy.
_END_MARKER = re.compile(r"^[#*\s]*Topics to discuss", re.IGNORECASE)
# Internal governance metadata that adds nothing to the agent's reasoning.
_DROP_LINE = re.compile(
    r"^\s*[-*]?\s*\**\s*(Last Assessed|Reassessment Deadline)\b", re.IGNORECASE
)
# Collapse markdown links whose target points at internal tooling (Slack
# permalinks, backoffice, Google Docs) down to their link text.
_INTERNAL_LINK = re.compile(
    r"\[([^\]]*)\]\(https?://[^)]*"
    r"(?:slack\.com|backoffice\.polar\.sh|docs\.google\.com)[^)]*\)"
)

_cache: tuple[float, str] | None = None
_cache_lock = asyncio.Lock()


class AUPPolicyError(Exception):
    """Raised when the Acceptable Use Policy cannot be fetched."""


def _strip_scaffolding(raw: str) -> str:
    """Reduce the raw working-document export to the agent-facing policy.

    Slices the document to the policy body, drops internal governance
    metadata, and unwraps links to internal tooling. Best-effort: if the
    boundary markers are missing (the doc was restructured), the text is
    returned untouched rather than silently dropping the whole policy.
    """
    lines = raw.splitlines()

    start = next((i for i, line in enumerate(lines) if _START_MARKER.match(line)), None)
    end = next((i for i, line in enumerate(lines) if _END_MARKER.match(line)), None)
    body = lines[start if start is not None else 0 : end if end is not None else None]

    body = [
        _INTERNAL_LINK.sub(r"\1", line) for line in body if not _DROP_LINE.match(line)
    ]

    cleaned = "\n".join(body).strip()
    return cleaned or raw.strip()


async def _get_access_token() -> str:
    from google.auth.transport.requests import Request as GoogleAuthRequest
    from google.oauth2 import service_account

    if not settings.GOOGLE_SERVICE_ACCOUNT_JSON:
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not configured.")

    try:
        info = json.loads(settings.GOOGLE_SERVICE_ACCOUNT_JSON)
    except json.JSONDecodeError as e:
        raise AUPPolicyError("GOOGLE_SERVICE_ACCOUNT_JSON is not valid JSON.") from e

    credentials = service_account.Credentials.from_service_account_info(
        info, scopes=_SCOPES
    )
    # Credential refresh is synchronous (uses `requests`), so run it off the
    # event loop.
    await asyncio.to_thread(credentials.refresh, GoogleAuthRequest())
    token = credentials.token
    if not token:
        raise AUPPolicyError("Failed to obtain a Google access token.")
    return token


async def _download_policy() -> str:
    token = await _get_access_token()
    url = _DRIVE_EXPORT_URL.format(file_id=settings.ORGANIZATION_REVIEW_AUP_DOCUMENT_ID)
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(
            url,
            params={"mimeType": "text/markdown"},
            headers={"Authorization": f"Bearer {token}"},
        )
    if response.status_code != 200:
        raise AUPPolicyError(
            f"Drive export failed ({response.status_code}): {response.text[:200]}"
        )
    return _strip_scaffolding(response.text)


async def fetch_policy_content() -> str:
    """Return the Acceptable Use Policy, fetched from Google Drive and cached.

    The content is cached in-process for
    ``ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS``. If a refresh fails but a
    previously fetched value is available, the stale value is served so a
    transient Drive/Google outage doesn't block reviews.
    """
    global _cache
    ttl = settings.ORGANIZATION_REVIEW_AUP_CACHE_TTL_SECONDS

    cached = _cache
    if cached is not None and time.monotonic() - cached[0] < ttl:
        return cached[1]

    async with _cache_lock:
        cached = _cache
        if cached is not None and time.monotonic() - cached[0] < ttl:
            return cached[1]

        try:
            content = await _download_policy()
        except Exception as e:
            if cached is not None:
                log.warning(
                    "organization_review.policy.refresh_failed",
                    error=str(e),
                )
                return cached[1]
            raise

        _cache = (time.monotonic(), content)
        return content
